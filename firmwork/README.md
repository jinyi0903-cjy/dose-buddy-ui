# Dose Buddy Firmware

This directory contains the embedded firmware for the Dose Buddy device.

## Requirements

- Arduino IDE or PlatformIO
- Compatible microcontroller board (see hardware doc or contact maintainer)

## Building and Flashing

1. Open `firmwork.ino` in Arduino IDE.
2. Select the appropriate board and port.
3. Click "Upload" to flash to the device.

Or use PlatformIO if preferred:

```bash
# From inside firmwork/
pio run --target upload
```

## Other Details

- All firmware logic is in `firmwork.ino`.
- Customize as needed for hardware changes.

---
