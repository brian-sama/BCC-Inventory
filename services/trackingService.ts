import { RfidStatus, TrackingResult } from '../types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class TrackingService {
  private rfidState: RfidStatus = {
    state: 'disconnected',
    message: 'Reader is not connected',
    lastChecked: new Date().toISOString(),
  };

  async scanQrCode(): Promise<TrackingResult> {
    await wait(500);
    return {
      success: true,
      mode: 'qr',
      code: `QR-${Date.now()}`,
      message: 'QR scan flow initialized (hardware adapter pending).',
      timestamp: new Date().toISOString(),
    };
  }

  async scanBarcode(): Promise<TrackingResult> {
    await wait(500);
    return {
      success: true,
      mode: 'barcode',
      code: `BAR-${Date.now()}`,
      message: 'Barcode scan flow initialized (hardware adapter pending).',
      timestamp: new Date().toISOString(),
    };
  }

  async getRfidStatus(): Promise<RfidStatus> {
    await wait(250);
    this.rfidState = { ...this.rfidState, lastChecked: new Date().toISOString() };
    return this.rfidState;
  }

  async connectRfidReader(): Promise<RfidStatus> {
    await wait(700);
    this.rfidState = {
      state: 'unavailable',
      message: 'RFID adapter hook ready. Device integration pending.',
      lastChecked: new Date().toISOString(),
    };
    return this.rfidState;
  }
}

export const trackingService = new TrackingService();
