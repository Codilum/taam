import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = "smtp.beget.com"
SMTP_PORT = 465  # SSL
SMTP_LOGIN = "noreply@taam.menu"  # укажи полный адрес почты
SMTP_PASSWORD = "e&qacm0MAtEW"           # пароль от почты

FROM_EMAIL = SMTP_LOGIN
TO_EMAIL = "it.mikita@gmail.com"         # можно указать любую почту для проверки

def send_email():
    # формируем письмо
    msg = MIMEMultipart()
    msg["From"] = FROM_EMAIL
    msg["To"] = TO_EMAIL
    msg["Subject"] = "Test email via 465 SSL"

    body = MIMEText("Привет! Это тестовое письмо через smtp.beget.com:465 (SSL).", "plain")
    msg.attach(body)

    try:
        # подключаемся по SSL
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_LOGIN, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, TO_EMAIL, msg.as_string())
            print("✅ Письмо успешно отправлено!")
    except Exception as e:
        print(f"❌ Ошибка отправки: {e}")

if __name__ == "__main__":
    send_email()
