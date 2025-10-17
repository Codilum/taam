from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
from jose import JWTError, jwt
import smtplib
from email.mime.text import MIMEText
from random import randint
from typing import List, Optional
from datetime import datetime, timedelta
import uvicorn
import sqlite3
import os
from pathlib import Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
import json
import csv
from io import StringIO

security = HTTPBearer()

# === Настройки ===
MAIL_SERVER = 'smtp.beget.com'
MAIL_PORT = 465
MAIL_USERNAME = 'noreply@taam.menu'
MAIL_PASSWORD = 'e&qacm0MAtEW'
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

DEFAULT_MENU_ITEM_PHOTO = "https://cdn0.iconfinder.com/data/icons/iconic-kitchen-stuffs-3/64/Kitchen_line_icon_-_expand_-_62px_Tudung_Saji-1024.png"

# Предопределенные типы ресторанов
RESTAURANT_TYPES = [
    "Ресторан",
    "Кафе",
    "Кофейня",
    "Фаст-фуд",
    "Столовая",
    "Пекарня",
    "Суши-бар",
]


# Предопределенные категории меню
MENU_CATEGORIES = [
    {"name": "Пользовательская", "description": "Введите название и описание для своей категории."},
    {"name": "Завтраки", "description": "Начните день с вкусного завтрака."},
    {"name": "Холодные закуски", "description": "Лёгкие и освежающие закуски."},
    {"name": "Горячие закуски", "description": "Сытные горячие закуски."},
    {"name": "Салаты", "description": "Свежие и полезные салаты."},
    {"name": "Супы", "description": "Горячие супы на каждый день."},
    {"name": "Основные блюда", "description": "Главные блюда на любой вкус."},
    {"name": "Мясо", "description": "Блюда из говядины, свинины и птицы."},
    {"name": "Рыба и морепродукты", "description": "Свежая рыба и морепродукты."},
    {"name": "Бургеры", "description": "Сочные бургеры с разнообразными начинками."},
    {"name": "Сэндвичи / Шаурма", "description": "Быстрые перекусы на каждый день."},
    {"name": "Паста", "description": "Итальянская паста с соусами."},
    {"name": "Пицца", "description": "Классическая и авторская пицца."},
    {"name": "Гарниры", "description": "Вкусные дополнения к основным блюдам."},
    {"name": "Картофель / Фри", "description": "Картофельные блюда на любой вкус."},
    {"name": "Суши", "description": "Свежие суши от шефа."},
    {"name": "Роллы", "description": "Разнообразные роллы для гурманов."},
    {"name": "Сеты", "description": "Готовые наборы для компании."},
    {"name": "Горячие блюда", "description": "Сытные и ароматные горячие блюда."},
    {"name": "Выпечка", "description": "Свежая домашняя выпечка."},
    {"name": "Выпечка с начинкой", "description": "Выпечка с мясной, сладкой или овощной начинкой."},
    {"name": "Хлеб", "description": "Свежий хлеб и булочки."},
    {"name": "Круассаны / Слойки", "description": "Слоёная выпечка для завтрака."},
    {"name": "Торты и пирожные", "description": "Сладкие десерты для праздников."},
    {"name": "Десерты", "description": "Нежные и вкусные десерты."},
    {"name": "Соусы", "description": "Домашние соусы к вашим блюдам."},
    {"name": "Комбо-наборы", "description": "Готовые наборы для перекуса и обеда."},
    {"name": "Кофе", "description": "Ароматный кофе на любой вкус."},
    {"name": "Чай", "description": "Разнообразные чаи для настроения."},
    {"name": "Напитки", "description": "Газированные и безалкогольные напитки."},
    {"name": "Лимонады", "description": "Освежающие лимонады собственного приготовления."},
    {"name": "Смузи", "description": "Полезные фруктовые смузи."},
    {"name": "Фреши", "description": "Свежевыжатые соки и фреши."},
]


# === FastAPI ===
app = FastAPI(openapi_url=None)

origins = ["https://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# === Хэширование пароля ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            email TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            verified BOOLEAN NOT NULL, 
            first_name TEXT,
            last_name TEXT,
            photo TEXT,
            phone TEXT,
            payment_method_type TEXT,
            payment_method_number TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS codes (
            email TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            code TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS restaurants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_email TEXT NOT NULL,
            photo TEXT,
            name TEXT NOT NULL,
            description TEXT,
            city TEXT,
            address TEXT,
            hours TEXT,
            instagram TEXT,
            telegram TEXT,
            vk TEXT,
            whatsapp TEXT,
            features TEXT,  -- JSON string для массива особенностей
            type TEXT,  -- Новый поле: тип ресторана
            phone TEXT,
            subdomain TEXT,
            FOREIGN KEY (owner_email) REFERENCES users (email) ON DELETE CASCADE
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS menu_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER NOT NULL,
            photo TEXT,
            name TEXT NOT NULL,
            description TEXT,
            placenum INTEGER DEFAULT 0,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            calories INTEGER,
            proteins REAL,
            fats REAL,
            carbs REAL,
            weight REAL,
            photo TEXT,
            view BOOLEAN DEFAULT TRUE,
            placenum INTEGER DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES menu_categories (id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

def migrate_db():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE users ADD COLUMN phone TEXT")
        conn.commit()
    except sqlite3.OperationalError as e:
        # Если столбец уже существует, игнорируем ошибку
        print(f"Миграция не требуется: {e}")
    finally:
        conn.close()

# Вызовите миграцию перед инициализацией базы
migrate_db()
init_db()


def build_photo_url(photo_value: Optional[str]) -> Optional[str]:
    if not photo_value:
        return None
    if photo_value.startswith("http://") or photo_value.startswith("https://"):
        return photo_value
    return f"/uploads/{photo_value}"


def format_menu_item_row(row: tuple) -> "MenuItem":
    return MenuItem(
        id=row[0],
        name=row[1],
        price=row[2],
        description=row[3],
        calories=row[4],
        proteins=row[5],
        fats=row[6],
        carbs=row[7],
        weight=row[8],
        photo=build_photo_url(row[9]),
        view=bool(row[10]),
        placenum=row[11],
    )


class Restaurant(BaseModel):
    id: int
    photo: Optional[str] = None
    name: str
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    hours: Optional[str] = None
    instagram: Optional[str] = None
    telegram: Optional[str] = None
    vk: Optional[str] = None
    whatsapp: Optional[str] = None
    features: List[str] = Field(default_factory=list)
    type: Optional[str] = None
    phone: Optional[str] = None
    subdomain: Optional[str] = None

class CreateRestaurantRequest(BaseModel):
    name: str
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    hours: Optional[str] = None
    instagram: Optional[str] = None
    telegram: Optional[str] = None
    vk: Optional[str] = None
    whatsapp: Optional[str] = None
    features: Optional[list[str]] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    subdomain: Optional[str] = None


class UpdateRestaurantRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    hours: Optional[str] = None
    instagram: Optional[str] = None
    telegram: Optional[str] = None
    vk: Optional[str] = None
    whatsapp: Optional[str] = None
    features: Optional[list[str]] = None
    type: Optional[str] = None
    phone: Optional[str] = None
    subdomain: Optional[str] = None


class MenuCategory(BaseModel):
    id: int
    photo: Optional[str] = None
    name: str
    description: Optional[str] = None
    placenum: int

class CreateMenuCategoryRequest(BaseModel):
    name: str
    description: Optional[str] = None
    placenum: Optional[int] = None

class UpdateMenuCategoryRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    placenum: Optional[int] = None

class MenuItem(BaseModel):
    id: int
    name: str
    price: float
    description: Optional[str] = None
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    weight: Optional[float] = None
    photo: Optional[str] = None
    view: bool
    placenum: int

class CreateMenuItemRequest(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    weight: Optional[float] = None
    view: Optional[bool] = True
    placenum: Optional[int] = None

class UpdateMenuItemRequest(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    weight: Optional[float] = None
    view: Optional[bool] = None 
    placenum: Optional[int] = None

# === Модели (остальные без изменений) ===
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    payment_method_type: Optional[str] = None
    payment_method_number: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class UserProfile(BaseModel):
    email: EmailStr
    first_name: Optional[str]
    last_name: Optional[str]
    photo: Optional[str]
    phone: Optional[str] = None
    payment_method_type: Optional[str]
    payment_method_number: Optional[str]
    is_profile_complete: bool

# === HTML-шаблон письма ===
def get_registration_email_template(code: str, user_name: str = "User") -> str:
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Ваш код регистрации</title>
      <style>
        body {{
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: #f9fafb;
          color: #111827;
          margin: 0;
          padding: 0;
        }}
        .container {{
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          padding: 32px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }}
        .header {{
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
        }}
        .message {{
          font-size: 16px;
          margin-bottom: 24px;
        }}
        .code {{
          display: inline-block;
          padding: 12px 24px;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 4px;
          background-color: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 24px;
        }}
        .footer {{
          font-size: 14px;
          color: #6b7280;
        }}
        .button {{
          display: inline-block;
          padding: 12px 24px;
          background-color: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
        }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Здравствуйте, {user_name}!</div>
        <div class="message">
          Вот ваш код для завершения проверки:
        </div>
        <div class="code">{code}</div>
        <div class="footer">
          Если вы не запрашивали этот код, просто проигнорируйте это письмо.
        </div>
      </div>
    </body>
    </html>
    """

# === Функции (без изменений) ===
def send_email(to_email: str, subject: str, body: str):
    msg = MIMEText(body, "html", "utf-8")  # ✅ HTML-письмо
    msg['Subject'] = subject
    msg['From'] = MAIL_USERNAME
    msg['To'] = to_email

    with smtplib.SMTP_SSL(MAIL_SERVER, MAIL_PORT) as server:
        server.login(MAIL_USERNAME, MAIL_PASSWORD)
        server.sendmail(MAIL_USERNAME, [to_email], msg.as_string())

    print(f"📨 Email sent to {to_email}")



def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise JWTError()
        return email
    except JWTError:
        return None

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")
    email = decode_access_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT verified FROM users WHERE email = ?", (email,))
    user = c.fetchone()
    conn.close()
    if not user or not user[0]:
        raise HTTPException(status_code=401, detail="Invalid or unverified user")
    return {"email": email}

# === Регистрация: отправка кода (без изменений) ===
@app.post("/api/register")
def register(req: RegisterRequest):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    
    # Проверяем, есть ли уже код или пользователь
    c.execute("SELECT email FROM users WHERE email = ?", (req.email,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    
    code = f"{randint(100000, 999999)}"
    # Сохраняем только код
    c.execute("INSERT OR REPLACE INTO codes (email, code, password_hash) VALUES (?, ?, ?)", (req.email, code, hash_password(req.password)))
    
    conn.commit()
    conn.close()

    html_body = get_registration_email_template(code, user_name=req.email)
    send_email(req.email, "Ваш код регистрации", html_body)
    return {"message": "Код подтверждения отправлен на email"}

@app.post("/api/verify")
def verify_code(req: VerifyCodeRequest):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # Проверяем код
    c.execute("SELECT code, password_hash FROM codes WHERE email = ?", (req.email,))
    row = c.fetchone()
    if not row or row[0] != req.code:
        conn.close()
        raise HTTPException(status_code=400, detail="Неверный код")
    
    password_hash = row[1]

    # Создаём пользователя
    c.execute(
        "INSERT INTO users (email, password_hash, verified, first_name, last_name, photo, phone, payment_method_type, payment_method_number) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (req.email, password_hash, True, None, None, None, None, None, None)
    )

    # Создаём ресторан по умолчанию
    c.execute("""
        INSERT INTO restaurants (owner_email, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.email, None, "Моё заведение", "Описание заведения", None, None, None,
        None, None, None, None, None, None, None, None
    ))

    # Удаляем код после успешной регистрации
    c.execute("DELETE FROM codes WHERE email = ?", (req.email,))

    conn.commit()
    conn.close()

    access_token = create_access_token({"sub": req.email})
    return {"message": "Регистрация подтверждена, заведение создано", "access_token": access_token}

# === Login и выдача JWT (без изменений) ===
@app.post("/api/login", response_model=Token)
def login(req: RegisterRequest):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT password_hash, verified FROM users WHERE email = ?", (req.email,))
    user = c.fetchone()
    conn.close()
    if not user or not user[1] or not verify_password(req.password, user[0]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    access_token = create_access_token({"sub": req.email})
    return {"access_token": access_token, "token_type": "bearer"}

# === Восстановление пароля (без изменений) ===
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@app.post("/api/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT email FROM users WHERE email = ?", (req.email,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    code = f"{randint(100000, 999999)}"
    c.execute("INSERT OR REPLACE INTO codes (email, code) VALUES (?, ?)", (req.email, code))
    conn.commit()
    conn.close()
    html_body = get_registration_email_template(code, user_name=req.email)
    send_email(req.email, "Код восстановления пароля", html_body)
    return {"message": "Код восстановления отправлен на email"}

@app.post("/api/reset-password")
def reset_password(req: ResetPasswordRequest):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT email FROM users WHERE email = ?", (req.email,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    c.execute("UPDATE users SET password_hash = ? WHERE email = ?", (hash_password(req.new_password), req.email))
    c.execute("DELETE FROM codes WHERE email = ?", (req.email,))
    conn.commit()
    conn.close()
    return {"message": "Пароль успешно обновлён"}

# === Профиль пользователя (без изменений) ===
@app.get("/api/me", response_model=UserProfile)
def read_me(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        "SELECT email, first_name, last_name, photo, phone, payment_method_type, payment_method_number "
        "FROM users WHERE email = ?",
        (current_user["email"],)
    )
    user = c.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    is_profile_complete = all([user[1], user[4]])  # проверяем что и имя, и телефон есть

    photo_url = f"/uploads/{user[3]}" if user[3] else None
    return {
        "email": user[0],
        "first_name": user[1],
        "last_name": user[2],
        "photo": photo_url,
        "phone": user[4],  # Добавляем phone
        "payment_method_type": user[5],
        "payment_method_number": user[6],
        "is_profile_complete": is_profile_complete
    }

@app.patch("/api/account")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    updates = []
    values = []

    if req.first_name is not None:
        updates.append("first_name = ?")
        values.append(req.first_name)
    if req.last_name is not None:
        updates.append("last_name = ?")
        values.append(req.last_name)
    if req.phone is not None:
        updates.append("phone = ?")
        values.append(req.phone)
    if req.payment_method_type is not None:
        updates.append("payment_method_type = ?")
        values.append(req.payment_method_type)
    if req.payment_method_number is not None:
        updates.append("payment_method_number = ?")
        values.append(req.payment_method_number)

    if not updates:
        raise HTTPException(status_code=400, detail="Нет полей для обновления")

    values.append(current_user["email"])

    query = f"UPDATE users SET {', '.join(updates)} WHERE email = ?"

    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(query, tuple(values))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    conn.commit()

    c.execute(
        "SELECT email, first_name, last_name, photo, phone, payment_method_type, payment_method_number "
        "FROM users WHERE email = ?",
        (current_user["email"],)
    )
    user = c.fetchone()
    conn.close()

    is_profile_complete = all(user[1:])  # Учитываем phone
    photo_url = f"/uploads/{user[3]}" if user[3] else None

    return {
        "message": "Профиль обновлён",
        "email": user[0],
        "first_name": user[1],
        "last_name": user[2],
        "photo": photo_url,
        "phone": user[4],  # Добавляем phone
        "payment_method_type": user[5],
        "payment_method_number": user[6],
        "is_profile_complete": is_profile_complete
    }

@app.delete("/api/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    
    # Удаляем фото пользователя, если есть
    c.execute("SELECT photo FROM users WHERE email = ?", (current_user["email"],))
    photo = c.fetchone()
    if photo and photo[0] and os.path.exists(UPLOAD_DIR / photo[0]):
        try:
            os.remove(UPLOAD_DIR / photo[0])
        except OSError:
            pass
    
    # Удаляем пользователя и связанные коды
    c.execute("DELETE FROM users WHERE email = ?", (current_user["email"],))
    c.execute("DELETE FROM codes WHERE email = ?", (current_user["email"],))
    
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    conn.commit()
    conn.close()
    return {"message": "Аккаунт удалён"}
# === Загрузка фото пользователя (без изменений) ===
@app.post("/api/upload-photo")
async def upload_photo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Только изображения разрешены")
    filename = f"{current_user['email']}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(await file.read())

    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("UPDATE users SET photo = ? WHERE email = ?", (str(filename), current_user["email"]))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    c.execute(
        "SELECT email, first_name, last_name, photo, phone, payment_method_type, payment_method_number "
        "FROM users WHERE email = ?",
        (current_user["email"],)
    )
    user = c.fetchone()
    conn.commit()
    conn.close()
    is_profile_complete = all([user[1], user[4]])  # проверяем что и имя, и телефон есть

    photo_url = f"/uploads/{filename}"
    return {
        "email": user[0],
        "first_name": user[1],
        "last_name": user[2],
        "photo": photo_url,
        "phone": user[4],  # Добавляем phone
        "payment_method_type": user[5],
        "payment_method_number": user[6],
        "is_profile_complete": is_profile_complete
    }

# === Удаление аккаунта (без изменений) ===
@app.delete("/api/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT photo FROM users WHERE email = ?", (current_user["email"],))
    photo = c.fetchone()
    if photo and photo[0] and os.path.exists(photo[0]):
        try:
            os.remove(photo[0])
        except OSError:
            pass
    c.execute("DELETE FROM users WHERE email = ?", (current_user["email"],))
    c.execute("DELETE FROM codes WHERE email = ?", (current_user["email"],))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    conn.commit()
    conn.close()
    return {"message": "Аккаунт удалён"}

# === Рестораны ===
@app.post("/api/restaurants", response_model=Restaurant)
def create_restaurant(req: CreateRestaurantRequest, current_user: dict = Depends(get_current_user)):
    if req.type and req.type not in RESTAURANT_TYPES:
        raise HTTPException(400, "Неверный тип ресторана")
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    features_json = json.dumps(req.features) if req.features else None
    c.execute('''
        INSERT INTO restaurants (owner_email, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        current_user["email"], None, req.name, req.description, req.city, req.address, req.hours,
        req.instagram, req.telegram, req.vk, req.whatsapp, features_json, req.type, req.phone, req.subdomain
    ))
    restaurant_id = c.lastrowid
    conn.commit()
    conn.close()
    return get_restaurant(restaurant_id)


@app.get("/api/restaurants", response_model=list[Restaurant])
def get_user_restaurants(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("""
        SELECT id, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain
        FROM restaurants WHERE owner_email = ?
    """, (current_user["email"],))
    rows = c.fetchall()
    conn.close()

    restaurants = []
    for row in rows:
        features = json.loads(row[11]) if row[11] else []
        photo_url = f"/uploads/{row[1]}" if row[1] else None
        restaurants.append({
            "id": row[0], "photo": photo_url, "name": row[2], "description": row[3],
            "city": row[4], "address": row[5], "hours": row[6],
            "instagram": row[7], "telegram": row[8], "vk": row[9], "whatsapp": row[10],
            "features": features, "type": row[12], "phone": row[13], "subdomain": row[14]
        })
    return restaurants
@app.get("/api/restaurants/{restaurant_id}", response_model=Restaurant)
def read_restaurant(restaurant_id: int):
    return get_restaurant(restaurant_id)


def get_restaurant(restaurant_id: int):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute('''
        SELECT id, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain
        FROM restaurants WHERE id = ?
    ''', (restaurant_id,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Заведение не найдено")
    
    features = json.loads(row[11]) if row[11] else []
    photo_url = f"/uploads/{row[1]}" if row[1] else None

    return {
        "id": row[0],
        "photo": photo_url,
        "name": row[2],
        "description": row[3],
        "city": row[4],
        "address": row[5],
        "hours": row[6],
        "instagram": row[7],
        "telegram": row[8],
        "vk": row[9],
        "whatsapp": row[10],
        "features": features,
        "type": row[12],
        "phone": row[13],
        "subdomain": row[14]
    }


@app.get("/api/restaurants/{restaurant_id}/menu")
def get_full_menu(restaurant_id: int):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # Получаем категории
    c.execute("""
        SELECT id, photo, name, description, placenum 
        FROM menu_categories 
        WHERE restaurant_id = ? 
        ORDER BY placenum ASC
    """, (restaurant_id,))
    categories = []

    for cat in c.fetchall():
        category_id = cat[0]
        photo_url = build_photo_url(cat[1])

        # Получаем блюда этой категории
        c.execute("""
            SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
            FROM menu_items 
            WHERE category_id = ? 
            ORDER BY placenum ASC
        """, (category_id,))
        items = []
        for row in c.fetchall():
            items.append(format_menu_item_row(row).dict())

        categories.append({
            "id": category_id,
            "photo": photo_url,
            "name": cat[2],
            "description": cat[3],
            "placenum": cat[4],
            "items": items
        })

    conn.close()
    return {"categories": categories}


@app.patch("/api/restaurants/{restaurant_id}")
def update_restaurant(restaurant_id: int, req: UpdateRestaurantRequest, current_user: dict = Depends(get_current_user)):
    if req.type and req.type not in RESTAURANT_TYPES:
        raise HTTPException(400, "Неверный тип ресторана")
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    updates = []
    values = []
    if req.name is not None:
        updates.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        updates.append("description = ?")
        values.append(req.description)
    if req.city is not None:
        updates.append("city = ?")
        values.append(req.city)
    if req.address is not None:
        updates.append("address = ?")
        values.append(req.address)
    if req.hours is not None:
        updates.append("hours = ?")
        values.append(req.hours)
    if req.instagram is not None:
        updates.append("instagram = ?")
        values.append(req.instagram)
    if req.telegram is not None:
        updates.append("telegram = ?")
        values.append(req.telegram)
    if req.vk is not None:
        updates.append("vk = ?")
        values.append(req.vk)
    if req.whatsapp is not None:
        updates.append("whatsapp = ?")
        values.append(req.whatsapp)
    if req.features is not None:
        updates.append("features = ?")
        values.append(json.dumps(req.features))
    if req.type is not None:
        updates.append("type = ?")
        values.append(req.type)
    if req.phone is not None:
        updates.append("phone = ?")
        values.append(req.phone)
    if req.subdomain is not None:
        updates.append("subdomain = ?")
        values.append(req.subdomain)
    if not updates:
        raise HTTPException(400, "Нет полей для обновления")
    values.append(restaurant_id)
    values.append(current_user["email"])
    query = f"UPDATE restaurants SET {', '.join(updates)} WHERE id = ? AND owner_email = ?"
    c.execute(query, tuple(values))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    conn.commit()
    conn.close()
    return {"message": "Обновлено"}


@app.delete("/api/restaurants/{restaurant_id}")
def delete_restaurant(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        "SELECT id FROM restaurants WHERE id = ? AND owner_email = ?",
        (restaurant_id, current_user["email"]),
    )
    restaurant = c.fetchone()
    if not restaurant:
        conn.close()
        raise HTTPException(status_code=404, detail="Заведение не найдено")

    c.execute(
        "DELETE FROM restaurants WHERE id = ? AND owner_email = ?",
        (restaurant_id, current_user["email"]),
    )
    conn.commit()
    conn.close()
    return {"message": "Заведение удалено"}

@app.post("/api/restaurants/{restaurant_id}/upload-photo")
async def upload_restaurant_photo(restaurant_id: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения")
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    filename = f"restaurant_{restaurant_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(await file.read())
    c.execute("UPDATE restaurants SET photo = ? WHERE id = ?", (str(filename), restaurant_id))
    conn.commit()
    conn.close()
    photo_url = f"/uploads/{filename}"
    return {"photo": photo_url}

# === Меню: Категории ===
@app.post("/api/restaurants/{restaurant_id}/menu-categories", response_model=MenuCategory)
def create_menu_category(restaurant_id: int, req: CreateMenuCategoryRequest, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    
    description = req.description
    if description is None:
        for cat in MENU_CATEGORIES:
            if cat["name"] == req.name:
                description = cat["description"]
                break
    
    if req.placenum is None:
        c.execute("SELECT MAX(placenum) FROM menu_categories WHERE restaurant_id = ?", (restaurant_id,))
        max_placenum = c.fetchone()[0] or 0
        placenum = max_placenum + 1
    else:
        placenum = req.placenum
    
    c.execute('''
        INSERT INTO menu_categories (restaurant_id, photo, name, description, placenum)
        VALUES (?, ?, ?, ?, ?)
    ''', (restaurant_id, None, req.name, description, placenum))
    category_id = c.lastrowid
    conn.commit()
    conn.close()
    return MenuCategory(id=category_id, photo=None, name=req.name, description=description, placenum=placenum)

@app.get("/api/restaurants/{restaurant_id}/menu-categories", response_model=list[MenuCategory])
def get_menu_categories(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    c.execute("""
        SELECT id, photo, name, description, placenum
        FROM menu_categories WHERE restaurant_id = ? ORDER BY placenum ASC
    """, (restaurant_id,))
    rows = c.fetchall()
    conn.close()
    categories = []
    for row in rows:
        photo_url = f"/uploads/{row[1]}" if row[1] else None
        categories.append(MenuCategory(id=row[0], photo=photo_url, name=row[2], description=row[3], placenum=row[4]))
    return categories

@app.patch("/api/restaurants/{restaurant_id}/menu-categories/{category_id}")
def update_menu_category(restaurant_id: int, category_id: int, req: UpdateMenuCategoryRequest, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    updates = []
    values = []
    if req.name is not None:
        updates.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        updates.append("description = ?")
        values.append(req.description)
    if req.placenum is not None:
        updates.append("placenum = ?")
        values.append(req.placenum)
    if not updates:
        raise HTTPException(400, "Нет полей для обновления")
    values.append(category_id)
    values.append(restaurant_id)
    query = f"UPDATE menu_categories SET {', '.join(updates)} WHERE id = ? AND restaurant_id = ?"
    c.execute(query, tuple(values))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Категория не найдена")
    conn.commit()
    conn.close()
    return {"message": "Категория обновлена"}

@app.post("/api/restaurants/{restaurant_id}/menu-categories/{category_id}/upload-photo")
async def upload_category_photo(restaurant_id: int, category_id: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения")
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Категория не найдена")
    filename = f"category_{category_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = UPLOAD_DIR / filename
    with open(file_path, "wb") as f:
        f.write(await file.read())
    c.execute("UPDATE menu_categories SET photo = ? WHERE id = ?", (str(filename), category_id))
    conn.commit()
    conn.close()
    photo_url = f"/uploads/{filename}"
    return {"photo": photo_url}

@app.delete("/api/restaurants/{restaurant_id}/menu-categories/{category_id}")
def delete_menu_category(restaurant_id: int, category_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    c.execute("SELECT photo FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    photo = c.fetchone()
    if photo and photo[0] and os.path.exists(UPLOAD_DIR / photo[0]):
        try:
            os.remove(UPLOAD_DIR / photo[0])
        except OSError:
            pass
    c.execute("DELETE FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(404, "Категория не найдена")
    conn.commit()
    conn.close()
    return {"message": "Категория удалена"}

@app.get("/api/restaurants/by-subdomain/{subdomain}", response_model=Restaurant)
def get_restaurant_by_subdomain(subdomain: str):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute('''
        SELECT id, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain
        FROM restaurants WHERE subdomain = ?
    ''', (subdomain,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Ресторан не найден")
    
    features = json.loads(row[11]) if row[11] else []
    photo_url = f"/uploads/{row[1]}" if row[1] else None
    
    return {
        "id": row[0],
        "photo": photo_url,
        "name": row[2],
        "description": row[3],
        "city": row[4],
        "address": row[5],
        "hours": row[6],
        "instagram": row[7],
        "telegram": row[8],
        "vk": row[9],
        "whatsapp": row[10],
        "features": features,
        "type": row[12],
        "phone": row[13],
        "subdomain": row[14]
    }

@app.get("/api/menu/by-subdomain/{subdomain}")
def get_menu_by_subdomain(subdomain: str):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    
    # Сначала находим ресторан по субдомену
    c.execute("SELECT id FROM restaurants WHERE subdomain = ?", (subdomain,))
    restaurant_row = c.fetchone()
    if not restaurant_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Ресторан не найден")
    
    restaurant_id = restaurant_row[0]
    
    # Получаем категории меню
    c.execute("""
        SELECT id, name, position, hidden
        FROM menu_categories
        WHERE restaurant_id = ? AND hidden = 0
        ORDER BY position ASC
    """, (restaurant_id,))
    categories = []
    for cat_row in c.fetchall():
        category_id, name, position, hidden = cat_row
        
        # Получаем блюда для категории
        c.execute("""
            SELECT id, name, description, price, photo, position
            FROM menu_items
            WHERE category_id = ? AND hidden = 0
            ORDER BY position ASC
        """, (category_id,))
        items = []
        for item_row in c.fetchall():
            item_id, item_name, description, price, photo, position = item_row
            photo_url = f"/uploads/{photo}" if photo else None
            items.append({
                "id": item_id,
                "name": item_name,
                "description": description,
                "price": price,
                "photo": photo_url,
                "position": position
            })
        
        categories.append({
            "id": category_id,
            "name": name,
            "position": position,
            "items": items
        })
    
    conn.close()
    
    return {"restaurant_id": restaurant_id, "categories": categories}


# === Меню: Блюда ===
@app.post("/api/restaurants/{restaurant_id}/menu-items/{item_id}/upload-photo")
async def upload_menu_item_photo(
    restaurant_id: int, 
    item_id: int, 
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения разрешены")
    
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    
    # Проверяем, что ресторан принадлежит пользователю
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", 
              (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    
    # Проверяем, что блюдо существует и принадлежит ресторану
    c.execute("""
        SELECT mi.id 
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = ? AND mc.restaurant_id = ?
    """, (item_id, restaurant_id))
    
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Блюдо не найдено")
    
    # Сохраняем файл
    filename = f"menu_item_{item_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    # Обновляем запись в базе данных
    c.execute("UPDATE menu_items SET photo = ? WHERE id = ?", (str(filename), item_id))
    conn.commit()
    conn.close()
    
    photo_url = f"/uploads/{filename}"
    return {"photo": photo_url}

# Добавьте этот эндпоинт в ваш FastAPI код
@app.get("/api/menu-categories")
def get_menu_categories_options():
    """
    Возвращает доступные категории меню
    """
    return {
        "categories": MENU_CATEGORIES  # Используем предопределенный список
    }

@app.post("/api/restaurants/{restaurant_id}/menu-categories/{category_id}/items", response_model=MenuItem)
def create_menu_item(restaurant_id: int, category_id: int, req: CreateMenuItemRequest, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Категория не найдена")
    
    if req.placenum is None:
        c.execute("SELECT MAX(placenum) FROM menu_items WHERE category_id = ?", (category_id,))
        max_placenum = c.fetchone()[0] or 0
        placenum = max_placenum + 1
    else:
        placenum = req.placenum
    
    view_value = req.view if req.view is not None else True
    c.execute('''
        INSERT INTO menu_items (category_id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        category_id,
        req.name,
        req.price,
        req.description,
        req.calories,
        req.proteins,
        req.fats,
        req.carbs,
        req.weight,
        DEFAULT_MENU_ITEM_PHOTO,
        int(bool(view_value)),
        placenum,
    ))
    item_id = c.lastrowid
    conn.commit()

    c.execute('''
        SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
        FROM menu_items WHERE id = ?
    ''', (item_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(500, "Не удалось создать блюдо")

    return format_menu_item_row(row)

@app.get("/api/restaurants/{restaurant_id}/menu-categories/{category_id}/items", response_model=list[MenuItem])
def get_menu_items(restaurant_id: int, category_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Категория не найдена")
    c.execute("""
        SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
        FROM menu_items WHERE category_id = ? ORDER BY placenum ASC
    """, (category_id,))
    rows = c.fetchall()
    conn.close()
    return [format_menu_item_row(row) for row in rows]


@app.post("/api/restaurants/{restaurant_id}/menu-categories/{category_id}/import-csv")
async def import_menu_items_from_csv(
    restaurant_id: int,
    category_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    raw_content = await file.read()
    if not raw_content:
        raise HTTPException(400, "Файл пустой")

    decoded_text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1251"):
        try:
            decoded_text = raw_content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue

    if decoded_text is None:
        raise HTTPException(400, "Не удалось прочитать файл. Используйте кодировку UTF-8")

    reader = csv.DictReader(StringIO(decoded_text))
    if not reader.fieldnames:
        raise HTTPException(400, "Файл не содержит заголовков")

    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")

    c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Категория не найдена")

    c.execute("SELECT MAX(placenum) FROM menu_items WHERE category_id = ?", (category_id,))
    max_placenum_row = c.fetchone()
    next_placenum = (max_placenum_row[0] or 0) if max_placenum_row else 0

    created = 0
    updated = 0
    errors: List[str] = []

    def normalize_row(row: dict) -> dict:
        normalized = {}
        for key, value in row.items():
            if key is None:
                continue
            normalized[key.strip().lower()] = (value.strip() if isinstance(value, str) else value)
        return normalized

    def get_value(normalized: dict, keys: List[str]) -> Optional[str]:
        for key in keys:
            if key in normalized and normalized[key] != "":
                return normalized[key]
        return None

    def parse_float(value: Optional[str], allow_negative: bool = False) -> Optional[float]:
        if value is None:
            return None
        normalized_value = value.replace(" ", "").replace(",", ".")
        if normalized_value == "":
            return None
        try:
            number = float(normalized_value)
            if not allow_negative and number < 0:
                return None
            return number
        except ValueError:
            return None

    def parse_int(value: Optional[str]) -> Optional[int]:
        float_value = parse_float(value)
        if float_value is None:
            return None
        return int(round(float_value))

    bju_keys = ["бжу"]
    name_keys = ["name", "название"]
    price_keys = ["price", "цена"]
    calories_keys = ["calories", "ккал", "калории"]
    description_keys = ["description", "описание"]
    weight_keys = ["weight", "вес"]
    proteins_keys = ["proteins", "protein", "белки", "белок"]
    fats_keys = ["fats", "fat", "жиры", "жир"]
    carbs_keys = ["carbs", "углеводы", "углев", "carbohydrates"]
    status_keys = ["status", "статус"]

    for index, row in enumerate(reader, start=2):  # 2 because header is line 1
        normalized = normalize_row(row)

        name = get_value(normalized, name_keys)
        if not name:
            errors.append(f"Строка {index}: отсутствует название блюда")
            continue

        price_raw = get_value(normalized, price_keys)
        price = parse_float(price_raw)
        if price is None:
            errors.append(f"Строка {index}: некорректное значение цены")
            continue

        description = get_value(normalized, description_keys)
        calories = parse_int(get_value(normalized, calories_keys))
        weight = parse_float(get_value(normalized, weight_keys))

        proteins = parse_float(get_value(normalized, proteins_keys))
        fats = parse_float(get_value(normalized, fats_keys))
        carbs = parse_float(get_value(normalized, carbs_keys))

        bju_value = get_value(normalized, bju_keys)
        if bju_value and (proteins is None or fats is None or carbs is None):
            parts = [part.strip() for part in csv.reader([bju_value.replace("/", ",")], delimiter=",").__next__()]
            parts = [part for part in parts if part != ""]
            if len(parts) == 3:
                proteins = parse_float(parts[0]) if proteins is None else proteins
                fats = parse_float(parts[1]) if fats is None else fats
                carbs = parse_float(parts[2]) if carbs is None else carbs

        status_value = get_value(normalized, status_keys)
        view = True
        if status_value:
            status_normalized = status_value.lower()
            if status_normalized in {"невидимое", "hidden", "0", "false", "нет"}:
                view = False
            elif status_normalized in {"видимое", "visible", "1", "true", "да"}:
                view = True

        c.execute(
            "SELECT id, photo FROM menu_items WHERE category_id = ? AND LOWER(name) = LOWER(?)",
            (category_id, name),
        )
        existing = c.fetchone()

        if existing:
            item_id, photo = existing
            c.execute(
                """
                UPDATE menu_items
                SET price = ?, description = ?, calories = ?, proteins = ?, fats = ?, carbs = ?, weight = ?, view = ?
                WHERE id = ?
                """,
                (
                    price,
                    description,
                    calories,
                    proteins,
                    fats,
                    carbs,
                    weight,
                    int(view),
                    item_id,
                ),
            )
            if not photo:
                c.execute(
                    "UPDATE menu_items SET photo = ? WHERE id = ?",
                    (DEFAULT_MENU_ITEM_PHOTO, item_id),
                )
            updated += 1
        else:
            next_placenum += 1
            c.execute(
                """
                INSERT INTO menu_items (category_id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    name,
                    price,
                    description,
                    calories,
                    proteins,
                    fats,
                    carbs,
                    weight,
                    DEFAULT_MENU_ITEM_PHOTO,
                    int(view),
                    next_placenum,
                ),
            )
            created += 1

    conn.commit()

    c.execute(
        """
        SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
        FROM menu_items WHERE category_id = ? ORDER BY placenum ASC
        """,
        (category_id,),
    )
    rows = c.fetchall()
    conn.close()

    items = [format_menu_item_row(row).dict() for row in rows]

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "items": items,
    }

@app.patch("/api/restaurants/{restaurant_id}/menu-items/{item_id}")
def update_menu_item(
    restaurant_id: int, 
    item_id: int, 
    req: UpdateMenuItemRequest, 
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # Проверка, что ресторан принадлежит текущему пользователю
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Заведение не найдено")

    # Проверка, что блюдо существует в ресторане
    c.execute("""
        SELECT mi.id 
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = ? AND mc.restaurant_id = ?
    """, (item_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Блюдо не найдено")

    # Формируем части запроса для обновления только переданных полей
    fields = []
    values = []

    if req.name is not None:
        fields.append("name = ?")
        values.append(req.name)
    if req.description is not None:
        fields.append("description = ?")
        values.append(req.description)
    if req.price is not None:
        fields.append("price = ?")
        values.append(req.price)
    if req.category_id is not None:
        c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (req.category_id, restaurant_id))
        if not c.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Категория не найдена в этом ресторане")
        fields.append("category_id = ?")
        values.append(req.category_id)
    if req.view is not None:
        fields.append("view = ?")
        values.append(int(req.view))
    if req.calories is not None:
        fields.append("calories = ?")
        values.append(req.calories)
    if req.proteins is not None:
        fields.append("proteins = ?")
        values.append(req.proteins)
    if req.fats is not None:
        fields.append("fats = ?")
        values.append(req.fats)
    if req.carbs is not None:
        fields.append("carbs = ?")
        values.append(req.carbs)
    if req.weight is not None:
        fields.append("weight = ?")
        values.append(req.weight)
    if req.placenum is not None:
        fields.append("placenum = ?")
        values.append(req.placenum)
    if not fields:
        conn.close()
        raise HTTPException(status_code=400, detail="Нет полей для обновления")

    values.append(item_id)
    query = f"UPDATE menu_items SET {', '.join(fields)} WHERE id = ?"
    c.execute(query, values)
    conn.commit()


    c.execute("""
        SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
        FROM menu_items WHERE id = ?
    """, (item_id,))
    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Блюдо не найдено")

    return format_menu_item_row(row)

@app.delete("/api/restaurants/{restaurant_id}/menu-items/{item_id}")
def delete_menu_item(
    restaurant_id: int, 
    item_id: int, 
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    # Проверка, что ресторан принадлежит текущему пользователю
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Заведение не найдено")

    # Проверка, что блюдо существует в ресторане
    c.execute("""
        SELECT mi.id 
        FROM menu_items mi
        JOIN menu_categories mc ON mi.category_id = mc.id
        WHERE mi.id = ? AND mc.restaurant_id = ?
    """, (item_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Блюдо не найдено")

    # Удаление блюда
    c.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

    return {"message": "Блюдо удалено"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)
