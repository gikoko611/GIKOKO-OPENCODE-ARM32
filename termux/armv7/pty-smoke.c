#define _GNU_SOURCE
#include <errno.h>
#include <poll.h>
#include <pty.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#define OUTPUT_CAP 4096
#define TIMEOUT_MS 5000

static long long monotonic_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return -1;
    return (long long)ts.tv_sec * 1000LL + ts.tv_nsec / 1000000LL;
}

static int contains_all(const char *text) {
    return strstr(text, "ARMV7_PTY_ECHO:hello-from-termux") != NULL &&
           strstr(text, "37 91") != NULL;
}

int main(void) {
    int master = -1;
    int status = 0;
    int child_reaped = 0;
    char output[OUTPUT_CAP];
    size_t used = 0;
    struct winsize size;
    memset(&size, 0, sizeof(size));
    size.ws_row = 37;
    size.ws_col = 91;

    pid_t child = forkpty(&master, NULL, NULL, &size);
    if (child < 0) {
        fprintf(stderr, "FAIL: forkpty: %s\n", strerror(errno));
        return 10;
    }

    if (child == 0) {
        execl("/system/bin/sh", "sh", "-c",
              "IFS= read -r line; printf 'ARMV7_PTY_ECHO:%s\\n' \"$line\"; stty size",
              (char *)NULL);
        _exit(127);
    }

    memset(output, 0, sizeof(output));
    if (ioctl(master, TIOCSWINSZ, &size) != 0) {
        fprintf(stderr, "FAIL: TIOCSWINSZ: %s\n", strerror(errno));
        goto fail;
    }

    const char input[] = "hello-from-termux\n";
    if (write(master, input, sizeof(input) - 1) != (ssize_t)(sizeof(input) - 1)) {
        fprintf(stderr, "FAIL: write to PTY master: %s\n", strerror(errno));
        goto fail;
    }

    long long deadline = monotonic_ms() + TIMEOUT_MS;
    while (monotonic_ms() < deadline && used < OUTPUT_CAP - 1) {
        struct pollfd pfd = { .fd = master, .events = POLLIN | POLLHUP };
        int remaining = (int)(deadline - monotonic_ms());
        int ready = poll(&pfd, 1, remaining > 0 ? remaining : 0);
        if (ready < 0 && errno == EINTR) continue;
        if (ready < 0) {
            fprintf(stderr, "FAIL: poll: %s\n", strerror(errno));
            goto fail;
        }
        if (ready == 0) break;
        ssize_t count = read(master, output + used, OUTPUT_CAP - used - 1);
        if (count > 0) {
            used += (size_t)count;
            output[used] = '\0';
            if (contains_all(output)) break;
            continue;
        }
        if (count < 0 && (errno == EINTR || errno == EAGAIN)) continue;
        break;
    }

    if (!contains_all(output)) {
        fprintf(stderr, "FAIL: expected PTY echo and 37x91 terminal size. Output was:\n%s\n", output);
        goto fail;
    }

    if (waitpid(child, &status, 0) != child) {
        fprintf(stderr, "FAIL: waitpid: %s\n", strerror(errno));
        goto fail;
    }
    child_reaped = 1;
    close(master);

    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
        fprintf(stderr, "FAIL: PTY child exit status=0x%x\n", status);
        return 11;
    }

    printf("PASS: Android Bionic forkpty() created a controlling terminal\n");
    printf("PASS: PTY master write/read round-trip\n");
    printf("PASS: terminal resize ioctl (37 rows x 91 columns)\n");
    printf("PASS: child shell exited cleanly\n");
    printf("Captured PTY output:\n%s\n", output);
    return 0;

fail:
    if (child > 0 && !child_reaped) {
        kill(child, SIGKILL);
        waitpid(child, &status, 0);
    }
    if (master >= 0) close(master);
    return 12;
}
