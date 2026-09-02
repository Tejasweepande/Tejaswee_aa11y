from PIL import Image
img = Image.open("test_pmkisan.png")
extrema = img.convert("L").getextrema()
print(f"Extrema (min, max) brightness: {extrema}")
colors = img.getcolors(maxcolors=2)
if colors:
    print(f"Colors: {colors}")
else:
    print("More than 2 colors")
