#!/usr/bin/env python3
"""Create placeholder icons for Chrome extension"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a simple icon with text"""
    # Create image with blue background
    img = Image.new('RGB', (size, size), color='#3498db')
    draw = ImageDraw.Draw(img)

    # Draw white circle
    margin = size // 8
    draw.ellipse([margin, margin, size-margin, size-margin], fill='#2980b9', outline='#ffffff', width=max(2, size//32))

    # Draw text (pencil emoji representation)
    try:
        font_size = size // 2
        text = "📝"
        # Try to center the text
        bbox = draw.textbbox((0, 0), text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        draw.text((x, y), text, fill='#ffffff')
    except:
        # If emoji fails, draw simple shapes
        center = size // 2
        draw.line([center-size//6, center-size//8, center-size//6, center+size//8], fill='#ffffff', width=max(2, size//16))
        draw.line([center-size//6, center+size//8, center+size//8, center+size//6], fill='#ffffff', width=max(2, size//16))

    img.save(filename, 'PNG')
    print(f"Created {filename}")

# Create icons
create_icon(16, '/home/user/Clipper/icons/icon16.png')
create_icon(48, '/home/user/Clipper/icons/icon48.png')
create_icon(128, '/home/user/Clipper/icons/icon128.png')

print("All icons created successfully!")
