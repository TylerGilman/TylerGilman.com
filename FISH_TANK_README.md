# Fish Tank Animation Documentation

This document explains how the fish tank animation works on TylerGilman.com.

## Overview

The website uses a 3D aquarium animation with procedurally animated fish as a background.
The animation is created using Three.js and is displayed on a canvas element.

## Fish Count Configuration

The fish count is configured to be **5 fish** throughout the application. This value is set in the following locations:

1. In `/views/layouts/base.templ` for the main template
2. In `/views/home/standalone.templ` for the standalone version
3. Default value in `/public/js/aquarium.js`

## Implementation Details

- The aquarium is rendered on a fixed canvas element that covers the entire viewport
- Content is layered on top of the aquarium using z-index
- Navigation and interactive elements have higher z-index values
- The fish movement is procedurally generated using constraints

## Unused Files

The following files were renamed to avoid confusion:

- `/views/components/nav_fishtank.templ.unused` - Unused navigation fish tank implementation
- `/handlers/landing.go.unused` - Previously used landing page handler (now using Templ-based approach)

## HTMX Integration

The fish tank persists even when navigating between pages through HTMX, creating a seamless experience
where only the content changes while the background animation continues running.

