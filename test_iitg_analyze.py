from PIL import Image
import numpy as np

img = Image.open("test_iitg.png")
arr = np.array(img)
white_pixels = np.sum((arr[:,:,0] >= 250) & (arr[:,:,1] >= 250) & (arr[:,:,2] >= 250))
total_pixels = arr.shape[0] * arr.shape[1]
print(f"White pixels: {white_pixels} / {total_pixels} ({(white_pixels/total_pixels)*100:.2f}%)")

non_white_rows = np.where(~((arr[:,:,0] >= 250) & (arr[:,:,1] >= 250) & (arr[:,:,2] >= 250)))[0]
if len(non_white_rows) > 0:
    print(f"Content goes down to row: {np.max(non_white_rows)}")
else:
    print("Image is entirely white!")
