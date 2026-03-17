export function createAppLogger(appName: string) {
  const prefix = `[${appName}]`;
  return {
    info(message: string): void {
      console.log(`${prefix} ${message}`);
    },
    warn(message: string): void {
      console.warn(`${prefix} ${message}`);
    },
    error(message: string): void {
      console.error(`${prefix} ${message}`);
    }
  };
}

