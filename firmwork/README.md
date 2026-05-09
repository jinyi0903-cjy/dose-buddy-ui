# PillPal Firmware

This directory contains the embedded firmware for the PillPal device.

## TODO
```
This is just an empty directory. All hardware logics in this directory is NOT IMPLEMENTED YET.
```

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
