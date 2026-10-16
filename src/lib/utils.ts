import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Small chips and row links grow to a finger-sized 36px on phones. Desktop keeps its compact size. */
export const touch = "max-md:inline-flex max-md:h-9 max-md:items-center max-md:px-3 max-md:text-[13px]"
