#!/usr/bin/env python3
"""Create minimal valid PNG icons without PIL"""

import struct
import zlib

def create_png(width, height, filename):
    """Create a simple solid color PNG"""

    # PNG signature
    png_signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # RGB image
    ihdr_chunk = b'IHDR' + ihdr_data
    ihdr_crc = struct.pack('>I', zlib.crc32(ihdr_chunk))
    ihdr = struct.pack('>I', len(ihdr_data)) + ihdr_chunk + ihdr_crc

    # IDAT chunk - create a simple blue gradient
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter type
        for x in range(width):
            # Create blue color with gradient
            r = 52  # #3498db
            g = 152
            b = 219
            raw_data += bytes([r, g, b])

    compressed_data = zlib.compress(raw_data, 9)
    idat_chunk = b'IDAT' + compressed_data
    idat_crc = struct.pack('>I', zlib.crc32(idat_chunk))
    idat = struct.pack('>I', len(compressed_data)) + idat_chunk + idat_crc

    # IEND chunk
    iend_chunk = b'IEND'
    iend_crc = struct.pack('>I', zlib.crc32(iend_chunk))
    iend = struct.pack('>I', 0) + iend_chunk + iend_crc

    # Write PNG file
    with open(filename, 'wb') as f:
        f.write(png_signature)
        f.write(ihdr)
        f.write(idat)
        f.write(iend)

    print(f"Created {filename}")

# Create icons
create_png(16, 16, '/home/user/Clipper/icons/icon16.png')
create_png(48, 48, '/home/user/Clipper/icons/icon48.png')
create_png(128, 128, '/home/user/Clipper/icons/icon128.png')

print("All icons created successfully!")
