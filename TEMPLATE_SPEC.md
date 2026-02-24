# Mipo photobooth – template size guide

Use these dimensions to design template images so the **photo slots** and **text area** line up with the app layout.

---

## Strip size (logical)

| Item | Value |
|------|--------|
| **Strip width** | **280 px** |
| **Strip padding** (all sides) | 8 px |
| **Content width** (for photos) | 264 px (280 − 16) |

---

## Photo slots

Each slot is a **3∶4 portrait** (width ÷ height = 0.75).

| Item | Value |
|------|--------|
| **Slot width** | **264 px** (full content width) |
| **Slot height** | **352 px** (264 ÷ 0.75) |
| **Gap between slots** | **6 px** |

So for **2 photos**: two 264×352 slots with 6 px between them.  
For **3 photos**: three such slots.  
For **4 photos**: four such slots.

---

## Strip height by template type

Total strip height = top/bottom padding (8+8) + photo area + text area (~100 px).

| Slots | Photo area height | Total strip height |
|-------|--------------------|---------------------|
| **2** | 352×2 + 6 = 710 px | **826 px** |
| **3** | 352×3 + 12 = 1068 px | **1184 px** |
| **4** | 352×4 + 18 = 1426 px | **1542 px** |

So your template canvas size should be:

- **2-photo template:** **280 × 826** px (width × height)
- **3-photo template:** **280 × 1184** px
- **4-photo template:** **280 × 1542** px

---

## Slot positions (from top of strip, after 8 px padding)

- **Slot 1:** Y = 8 px, height 352 px  
- **Slot 2:** Y = 8 + 352 + 6 = 366 px, height 352 px  
- **Slot 3:** Y = 366 + 352 + 6 = 724 px, height 352 px  
- **Slot 4:** Y = 724 + 352 + 6 = 1082 px, height 352 px  

All slots: **X = 8 px**, **width = 264 px**.  
Leave these areas as **cutouts** or **transparent** so the captured photos show through.

---

## Text area

The text block sits **below the last photo slot**, with:

- **Padding:** 16 px top/bottom, 12 px left/right  
- **Approx. height:** ~100 px (title, names, date, brand)

You can add a background or frame in your template for this area; keep the text region in mind so your design doesn’t overlap the app’s text.

---

## High-DPI (2×) for export

The app captures the strip at **2×** (560 px width). For a 2× template:

- **Width:** **560 px**
- **Heights:** 2 slots **1652 px**, 3 slots **2368 px**, 4 slots **3084 px**
- **Slot size:** **528 × 704 px**
- **Slot gap:** 12 px  
- **Strip padding:** 16 px  

Design at 280 px width then export at 2×, or design directly at 560 px using the 2× numbers above.

---

## Summary – recommended template canvas

| Template | Width | Height (1×) | Height (2×) |
|----------|--------|-------------|-------------|
| 2 photos | 280 px | 826 px | 1652 px |
| 3 photos | 280 px | 1184 px | 2368 px |
| 4 photos | 280 px | 1542 px | 3084 px |

Save as PNG (with transparency for the photo cutouts if you use a frame). Put files in `mipo-server/public/templates/` (e.g. `2-photo.png`, `3-photo.png`, `4-photo.png`).
