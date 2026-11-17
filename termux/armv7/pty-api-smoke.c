#define _GNU_SOURCE
#include <pty.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>
#include <errno.h>

/*
 * Minimal Android/Bionic PTY capability probe.
 * This is deliberately not a process-spawning PTY backend.
 */
int armv7_pty_api_version(void) {
    return 1;
}

int armv7_openpty_resize_probe(void) {
    int master = -1;
    int slave = -1;
    struct winsize size = {
        .ws_row = 24,
        .ws_col = 80,
        .ws_xpixel = 0,
        .ws_ypixel = 0,
    };

    if (openpty(&master, &slave, NULL, NULL, &size) != 0) {
        return -1000 - errno;
    }
    if (ioctl(slave, TIOCSWINSZ, &size) != 0) {
        int error = errno;
        close(slave);
        close(master);
        return -2000 - error;
    }

    struct winsize actual = {0};
    if (ioctl(slave, TIOCGWINSZ, &actual) != 0) {
        int error = errno;
        close(slave);
        close(master);
        return -3000 - error;
    }

    close(slave);
    close(master);
    if (actual.ws_row != 24 || actual.ws_col != 80) return -4001;
    return 0;
}
