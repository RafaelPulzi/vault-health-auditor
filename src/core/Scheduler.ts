export class Scheduler {
  async yield(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }

      setTimeout(() => resolve(), 0);
    });
  }
}
