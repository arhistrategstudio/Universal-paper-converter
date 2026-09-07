from PIL import Image, ImageDraw, ImageFont
import io

img = Image.new('RGB', (600, 200), color=(255, 255, 255))
d = ImageDraw.Draw(img)
# Ispiši tekst na papiru
d.text((40, 40), "Sastanak 7.9.2026.", fill=(0, 0, 0))
d.text((40, 80), "Marko - poslati ponudu", fill=(0, 0, 0))
d.text((40, 120), "Ana - pozvati klijenta", fill=(0, 0, 0))
d.text((40, 160), "Sledeci sastanak petak u 10h", fill=(0, 0, 0))

buf = io.BytesIO()
img.save(buf, format='JPEG')
with open("test_sample_paper.jpg", "wb") as f:
    f.write(buf.getvalue())
print("Test image created: test_sample_paper.jpg")
