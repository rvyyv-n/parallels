import type { Column, DType } from "../../../dataset/contract";

export type Raw = Uint8Array | Uint16Array | Int16Array | Float32Array;

const arrays = { u8: Uint8Array, u16: Uint16Array, i16: Int16Array, f32: Float32Array };
const defaultNodata: Partial<Record<DType, number>> = { u8: 255, u16: 65535, i16: -32768 };

export const bytesPer = (c: Column) => arrays[c.dtype].BYTES_PER_ELEMENT;

export const typed = (buffer: ArrayBuffer, c: Column): Raw => new arrays[c.dtype](buffer);

export const nodata = (c: Column) => c.nodata ?? defaultNodata[c.dtype];

export function decode(raw: number, c: Column): number | null {
  if (raw === nodata(c)) return null;
  return raw * (c.scale ?? 1) + (c.add ?? 0);
}
