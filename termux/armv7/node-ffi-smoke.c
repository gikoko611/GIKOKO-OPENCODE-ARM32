#include <stdint.h>

__attribute__((visibility("default")))
int32_t armv7_ffi_add_i32(int32_t left, int32_t right) {
    return left + right;
}

__attribute__((visibility("default")))
uint64_t armv7_ffi_xor_u64(uint64_t left, uint64_t right) {
    return left ^ right;
}

__attribute__((visibility("default")))
double armv7_ffi_add_f64(double left, double right) {
    return left + right;
}

__attribute__((visibility("default")))
void *armv7_ffi_echo_pointer(void *value) {
    return value;
}
