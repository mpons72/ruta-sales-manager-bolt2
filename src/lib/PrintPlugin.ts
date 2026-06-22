import { registerPlugin } from '@capacitor/core';

export interface CapacitorPrintPlugin {
  print(options: { content: string }): Promise<{ success: boolean }>;
}

const CapacitorPrint = registerPlugin<CapacitorPrintPlugin>('CapacitorPrint');

export default CapacitorPrint;
