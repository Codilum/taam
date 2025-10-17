import qrcode
from PIL import Image

data = 'http://mona.taam.menu'
qr = qrcode.QRCode(version=3, box_size=8, border=4)
qr.add_data(data)
qr.make(fit=True)

image = qr.make_image(fill="black", back_color="white")
image.save("qr_code.png")
Image.open("qr_code.png")