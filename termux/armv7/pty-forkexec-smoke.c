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

static long long now_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) return -1;
    return (long long)ts.tv_sec * 1000LL + ts.tv_nsec / 1000000LL;
}

int main(void) {
    int master = -1;
    int status = 0;
    int child_done = 0;
    int saw_marker = 0;
    int saw_dimensions = 0;
    char output[8192];
    size_t used = 0;
    struct winsize ws = {.ws_row = 24, .ws_col = 80, .ws_xpixel = 0, .ws_ypixel = 0};

    pid_t pid = forkpty(&master, NULL, NULL, &ws);
    if (pid < 0) {
        perror("forkpty");
        return 10;
    }
    if (pid == 0) {
        execl("/system/bin/sh", "sh", "-c",
              "printf 'PTY_CHILD_OK\\n'; stty size; exit 7",
              (char *)NULL);
        _exit(127);
    }

    long long deadline = now_ms() + 7000;
    while (!child_done || !saw_marker || !saw_dimensions) {
        long long remaining = deadline - now_ms();
        if (remaining <= 0) {
            fprintf(stderr, "PTY probe timeout; output=%.*s\\n", (int)used, output);
            kill(pid, SIGKILL);
            waitpid(pid, &status, 0);
            close(master);
            return 11;
        }

        struct pollfd pfd = {.fd = master, .events = POLLIN | POLLHUP};
        int pr = poll(&pfd, 1, remaining > 200 ? 200 : (int)remaining);
        if (pr < 0 && errno != EINTR) {
            perror("poll");
            kill(pid, SIGKILL);
            waitpid(pid, &status, 0);
            close(master);
            return 12;
        }

        if (pr > 0 && (pfd.revents & (POLLIN | POLLHUP))) {
            char chunk[512];
            ssize_t n;
            while ((n = read(master, chunk, sizeof(chunk))) > 0) {
                size_t copy = (size_t)n;
                if (copy > sizeof(output) - 1 - used) copy = sizeof(output) - 1 - used;
                if (copy) {
                    memcpy(output + used, chunk, copy);
                    used += copy;
                    output[used] = '\0';
                }
            }
            if (n < 0 && errno != EIO && errno != EAGAIN && errno != EINTR) {
                perror("read PTY master");
                kill(pid, SIGKILL);
                waitpid(pid, &status, 0);
                close(master);
                return 13;
            }
            saw_marker = strstr(output, "PTY_CHILD_OK") != NULL;
            saw_dimensions = strstr(output, "24 80") != NULL || strstr(output, "24  80") != NULL;
        }

        if (!child_done) {
            pid_t w = waitpid(pid, &status, WNOHANG);
            if (w == pid) child_done = 1;
            else if (w < 0 && errno != EINTR) {
                perror("waitpid");
                close(master);
                return 14;
            }
        }
        if (child_done && !(pfd.revents & (POLLIN | POLLHUP))) {
            /* Give the PTY master one final short read for buffered terminal output. */
            struct pollfd last = {.fd = master, .events = POLLIN | POLLHUP};
            if (poll(&last, 1, 100) > 0) continue;
            break;
        }
    }

    close(master);
    if (!WIFEXITED(status) || WEXITSTATUS(status) != 7) {
        fprintf(stderr, "Unexpected child status: 0x%x\\n", status);
        return 15;
    }
    if (!saw_marker || !saw_dimensions) {
        fprintf(stderr, "Missing expected PTY output: %.*s\\n", (int)used, output);
        return 16;
    }

    printf("PASS: forkpty created a controlling terminal and spawned /system/bin/sh\\n");
    printf("PASS: child terminal output streamed through the PTY master\\n");
    printf("PASS: child observed terminal dimensions 24x80\\n");
    printf("PASS: waitpid reported the expected child exit code 7\\n");
    return 0;
}
