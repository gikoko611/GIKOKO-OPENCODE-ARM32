#define _GNU_SOURCE
#include <node_api.h>
#include <stdbool.h>
#include <pty.h>
#include <sys/ioctl.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <signal.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static napi_value fail(napi_env env, const char *message) {
  napi_throw_error(env, NULL, message);
  return NULL;
}

static int get_i32(napi_env env, napi_value value, int *out) {
  return napi_get_value_int32(env, value, out) == napi_ok;
}

static char *get_string(napi_env env, napi_value value) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok) return NULL;
  char *result = (char *)malloc(length + 1);
  if (!result) return NULL;
  if (napi_get_value_string_utf8(env, value, result, length + 1, &length) != napi_ok) {
    free(result);
    return NULL;
  }
  return result;
}

static void free_strings(char **items, uint32_t count) {
  if (!items) return;
  for (uint32_t i = 0; i < count; i++) free(items[i]);
  free(items);
}

/* spawn(file, args[], rows, cols[, cwd, env]) -> { pid, fd } */
static napi_value spawn_pty(napi_env env, napi_callback_info info) {
  size_t argc = 6;
  napi_value argv[6];
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc < 4 || argc > 6)
    return fail(env, "spawn(file, args, rows, cols[, cwd, env]) requires four to six arguments");

  char *file = get_string(env, argv[0]);
  if (!file || !*file) { free(file); return fail(env, "spawn: executable path is empty or invalid"); }
  char *cwd = NULL;
  if (argc >= 5) {
    napi_valuetype type;
    if (napi_typeof(env, argv[4], &type) != napi_ok) { free(file); return fail(env, "spawn: invalid cwd"); }
    if (type != napi_null && type != napi_undefined) {
      cwd = get_string(env, argv[4]);
      if (!cwd) { free(file); return fail(env, "spawn: cwd must be a string or null"); }
    }
  }

  bool is_array = false;
  if (napi_is_array(env, argv[1], &is_array) != napi_ok || !is_array) {
    free(cwd); free(file); return fail(env, "spawn: args must be an array");
  }
  uint32_t count = 0;
  if (napi_get_array_length(env, argv[1], &count) != napi_ok || count > 256) {
    free(cwd); free(file); return fail(env, "spawn: args array is invalid or too long");
  }
  char **child_argv = (char **)calloc((size_t)count + 2, sizeof(char *));
  if (!child_argv) { free(cwd); free(file); return fail(env, "spawn: out of memory"); }
  child_argv[0] = strdup(file);
  if (!child_argv[0]) { free(child_argv); free(cwd); free(file); return fail(env, "spawn: out of memory"); }
  for (uint32_t i = 0; i < count; i++) {
    napi_value item;
    if (napi_get_element(env, argv[1], i, &item) != napi_ok || !(child_argv[i + 1] = get_string(env, item))) {
      free_strings(child_argv, i + 1); free(cwd); free(file);
      return fail(env, "spawn: every argument must be a string");
    }
  }

  char **env_items = NULL;
  uint32_t env_count = 0;
  if (argc >= 6) {
    bool is_array_env = false;
    napi_valuetype env_type;
    if (napi_typeof(env, argv[5], &env_type) != napi_ok || env_type != napi_object ||
        napi_is_array(env, argv[5], &is_array_env) != napi_ok || is_array_env) {
      free_strings(child_argv, count + 1); free(cwd); free(file);
      return fail(env, "spawn: env must be an object");
    }
    napi_value keys;
    if (napi_get_property_names(env, argv[5], &keys) != napi_ok ||
        napi_get_array_length(env, keys, &env_count) != napi_ok || env_count > 512) {
      free_strings(child_argv, count + 1); free(cwd); free(file);
      return fail(env, "spawn: env object is invalid or too large");
    }
    env_items = (char **)calloc((size_t)env_count + 1, sizeof(char *));
    if (!env_items) {
      free_strings(child_argv, count + 1); free(cwd); free(file);
      return fail(env, "spawn: out of memory");
    }
    for (uint32_t i = 0; i < env_count; i++) {
      napi_value key_value, val_value;
      char *key = NULL, *val = NULL;
      if (napi_get_element(env, keys, i, &key_value) != napi_ok ||
          napi_get_property(env, argv[5], key_value, &val_value) != napi_ok ||
          !(key = get_string(env, key_value)) || !(val = get_string(env, val_value)) ||
          !*key || strchr(key, '=')) {
        free(key); free(val); free_strings(env_items, i);
        free_strings(child_argv, count + 1); free(cwd); free(file);
        return fail(env, "spawn: env keys and values must be strings; keys cannot contain '='");
      }
      size_t key_len = strlen(key), val_len = strlen(val);
      env_items[i] = (char *)malloc(key_len + val_len + 2);
      if (!env_items[i]) {
        free(key); free(val); free_strings(env_items, i);
        free_strings(child_argv, count + 1); free(cwd); free(file);
        return fail(env, "spawn: out of memory");
      }
      memcpy(env_items[i], key, key_len);
      env_items[i][key_len] = '=';
      memcpy(env_items[i] + key_len + 1, val, val_len + 1);
      free(key); free(val);
    }
  }

  int rows = 24, cols = 80;
  if (!get_i32(env, argv[2], &rows) || !get_i32(env, argv[3], &cols) ||
      rows < 1 || rows > 1000 || cols < 1 || cols > 1000) {
    free_strings(env_items, env_count); free_strings(child_argv, count + 1); free(cwd); free(file);
    return fail(env, "spawn: rows/cols must be between 1 and 1000");
  }

  struct winsize ws = {0};
  ws.ws_row = (unsigned short)rows;
  ws.ws_col = (unsigned short)cols;
  int exec_error[2];
  if (pipe2(exec_error, O_CLOEXEC) != 0) {
    int saved = errno;
    free_strings(env_items, env_count); free_strings(child_argv, count + 1); free(cwd); free(file);
    return fail(env, strerror(saved));
  }
  int master = -1;
  pid_t pid = forkpty(&master, NULL, NULL, &ws);
  if (pid < 0) {
    int saved = errno;
    close(exec_error[0]); close(exec_error[1]);
    free_strings(env_items, env_count); free_strings(child_argv, count + 1); free(cwd); free(file);
    return fail(env, strerror(saved));
  }
  if (pid == 0) {
    close(exec_error[0]);
    int child_error = 0;
    if (cwd && chdir(cwd) != 0) child_error = errno;
    for (uint32_t i = 0; !child_error && i < env_count; i++) {
      char *separator = strchr(env_items[i], '=');
      if (separator) {
        *separator = '\0';
        if (setenv(env_items[i], separator + 1, 1) != 0) child_error = errno;
      }
    }
    if (!child_error) {
      execvp(file, child_argv);
      child_error = errno;
    }
    (void)write(exec_error[1], &child_error, sizeof(child_error));
    _exit(127);
  }

  close(exec_error[1]);
  int child_error = 0;
  ssize_t error_bytes;
  do {
    error_bytes = read(exec_error[0], &child_error, sizeof(child_error));
  } while (error_bytes < 0 && errno == EINTR);
  close(exec_error[0]);
  free_strings(env_items, env_count); free_strings(child_argv, count + 1); free(cwd); free(file);
  if (error_bytes > 0) {
    int ignored;
    while (waitpid(pid, &ignored, 0) < 0 && errno == EINTR) {}
    close(master);
    return fail(env, strerror(child_error));
  }
  if (error_bytes < 0) {
    int saved = errno;
    (void)kill(pid, SIGKILL);
    int ignored;
    while (waitpid(pid, &ignored, 0) < 0 && errno == EINTR) {}
    close(master);
    return fail(env, strerror(saved));
  }

  int flags = fcntl(master, F_GETFL);
  if (flags >= 0) (void)fcntl(master, F_SETFL, flags | O_NONBLOCK);
  (void)fcntl(master, F_SETFD, FD_CLOEXEC);

  napi_value result, value;
  napi_create_object(env, &result);
  napi_create_int32(env, (int32_t)pid, &value);
  napi_set_named_property(env, result, "pid", value);
  napi_create_int32(env, master, &value);
  napi_set_named_property(env, result, "fd", value);
  return result;
}

static napi_value resize_pty(napi_env env, napi_callback_info info) {
  size_t argc = 3; napi_value argv[3]; int fd, rows, cols;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 3 ||
      !get_i32(env, argv[0], &fd) || !get_i32(env, argv[1], &rows) || !get_i32(env, argv[2], &cols) ||
      fd < 0 || rows < 1 || rows > 1000 || cols < 1 || cols > 1000)
    return fail(env, "resize(fd, rows, cols): invalid arguments");
  struct winsize ws = {0}; ws.ws_row = (unsigned short)rows; ws.ws_col = (unsigned short)cols;
  if (ioctl(fd, TIOCSWINSZ, &ws) != 0) return fail(env, strerror(errno));
  napi_value result; napi_get_undefined(env, &result); return result;
}

static napi_value signal_child(napi_env env, napi_callback_info info) {
  size_t argc = 2; napi_value argv[2]; int pid, sig;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 2 ||
      !get_i32(env, argv[0], &pid) || !get_i32(env, argv[1], &sig) || pid <= 1 || sig < 0 || sig >= NSIG)
    return fail(env, "signal(pid, signal): invalid arguments");
  if (kill((pid_t)pid, sig) != 0) return fail(env, strerror(errno));
  napi_value result; napi_get_undefined(env, &result); return result;
}

/* wait(pid) -> null while running, otherwise { pid, status, exitCode, signal } */
static napi_value wait_child(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value argv[1]; int pid;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1 ||
      !get_i32(env, argv[0], &pid) || pid <= 1)
    return fail(env, "wait(pid): invalid pid");
  int status = 0;
  pid_t result;
  do {
    result = waitpid((pid_t)pid, &status, WNOHANG);
  } while (result < 0 && errno == EINTR);
  if (result == 0) { napi_value null_value; napi_get_null(env, &null_value); return null_value; }
  if (result < 0) return fail(env, strerror(errno));
  napi_value object, value;
  napi_create_object(env, &object);
  napi_create_int32(env, (int32_t)result, &value); napi_set_named_property(env, object, "pid", value);
  napi_create_int32(env, status, &value); napi_set_named_property(env, object, "status", value);
  napi_create_int32(env, WIFEXITED(status) ? WEXITSTATUS(status) : -1, &value);
  napi_set_named_property(env, object, "exitCode", value);
  napi_create_int32(env, WIFSIGNALED(status) ? WTERMSIG(status) : 0, &value);
  napi_set_named_property(env, object, "signal", value);
  return object;
}

static napi_value close_fd(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value argv[1]; int fd;
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1 ||
      !get_i32(env, argv[0], &fd) || fd < 0)
    return fail(env, "close(fd): invalid descriptor");
  if (close(fd) != 0) return fail(env, strerror(errno));
  napi_value result; napi_get_undefined(env, &result); return result;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    { "spawn", NULL, spawn_pty, NULL, NULL, NULL, napi_default, NULL },
    { "resize", NULL, resize_pty, NULL, NULL, NULL, napi_default, NULL },
    { "signal", NULL, signal_child, NULL, NULL, NULL, napi_default, NULL },
    { "wait", NULL, wait_child, NULL, NULL, NULL, napi_default, NULL },
    { "close", NULL, close_fd, NULL, NULL, NULL, napi_default, NULL },
  };
  if (napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods) != napi_ok)
    return fail(env, "failed to export PTY methods");
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
