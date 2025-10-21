#!/bin/bash
# Install fonts for Sharp/librsvg on Vercel
set -e

echo "Installing fonts for SVG rendering..."

# Install common fonts that work with Sharp/librsvg
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  fonts-dejavu-core \
  fonts-liberation \
  fontconfig

# Update font cache
fc-cache -f -v

echo "Fonts installed successfully"
