export const transformMacAddress = (mac: string) => {
    // Remove colons and convert to lowercase
    return mac.replace(/:/g, '').toLowerCase();
}
