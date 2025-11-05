from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form, Request
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
import qrcode
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import json
import csv
from io import StringIO
from uuid import uuid4

from yookassa import Configuration, Payment

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


YOOKASSA_SHOP_ID = '1186945'
YOOKASSA_SECRET_KEY = 'live_aJYr7cT3tWqREG6lHzrQ8MvXBurdTAvfmUFlzXeHV_w'
YOOKASSA_RETURN_URL = os.getenv("YOOKASSA_RETURN_URL", "https://taam.menu/dashboard?block=subscription")

if YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY:
    Configuration.account_id = YOOKASSA_SHOP_ID
    Configuration.secret_key = YOOKASSA_SECRET_KEY

TESTING_USERS_TOKEN = os.getenv("TESTING_USERS_TOKEN")


def format_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")


SUBSCRIPTION_PLANS_DATA = [
    {
        "code": "base",
        "name": "Базовая",
        "description": "Стартовый тариф без оплаты.",
        "price": 0,
        "currency": "RUB",
        "duration_days": None,
        "category_limit": 3,
        "item_limit": 5,
        "is_full_access": False,
        "is_trial": False,
        "features": [
            "До 3 категорий меню",
            "До 5 блюд в каждой категории",
            "Можно перейти на премиум в любой момент",
        ],
        "is_hidden": False,
    },
    {
        "code": "trial",
        "name": "Пробная",
        "description": "Полный доступ на 3 дня.",
        "price": 100,
        "currency": "RUB",
        "duration_days": 3,
        "category_limit": None,
        "item_limit": None,
        "is_full_access": True,
        "is_trial": True,
        "features": [
            "Полный доступ без ограничений",
        ],
        "is_hidden": False,
    },
    {
        "code": "premium",
        "name": "Премиум",
        "description": "Полный доступ на месяц.",
        "price": 299900,
        "currency": "RUB",
        "duration_days": 30,
        "category_limit": None,
        "item_limit": None,
        "is_full_access": True,
        "is_trial": False,
        "features": [
            "Без ограничений по категориям",
            "Без ограничений по блюдам",
            "Поддержка приоритетного уровня",
        ],
        "is_hidden": False,
    },
    {
        "code": "testing",
        "name": "Тестирование",
        "description": "Скрытый тариф для выдачи бесплатного доступа.",
        "price": 0,
        "currency": "RUB",
        "duration_days": None,
        "category_limit": None,
        "item_limit": None,
        "is_full_access": True,
        "is_trial": False,
        "features": [
            "Полный доступ без ограничений",
            "Используется для тестовых пользователей",
        ],
        "is_hidden": True,
    },
]


def delete_uploaded_file(filename: Optional[str]) -> None:
    if not filename:
        return
    if filename.startswith("http://") or filename.startswith("https://"):
        return
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        try:
            file_path.unlink()
        except OSError:
            pass


def _qr_file_path(restaurant_id: int) -> Path:
    return UPLOAD_DIR / f"qr_{restaurant_id}.png"


def generate_qr_for_restaurant(restaurant_id: int, subdomain: str) -> None:
    link = subdomain.strip()
    if not link:
        remove_qr_for_restaurant(restaurant_id)
        return
    full_link = f"https://{link}.taam.menu"
    qr = qrcode.QRCode(version=3, box_size=8, border=4)
    qr.add_data(full_link)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white")
    remove_qr_for_restaurant(restaurant_id=restaurant_id)
    path = _qr_file_path(restaurant_id)
    image.save(path)


def remove_qr_for_restaurant(restaurant_id: int) -> None:
    path = _qr_file_path(restaurant_id)
    if path.exists():
        try:
            path.unlink()
        except OSError:
            pass


def get_qr_url(restaurant_id: int) -> Optional[str]:
    path = _qr_file_path(restaurant_id)
    if path.exists():
        return f"/uploads/{path.name}"
    return None


def get_payment_confirmation_url(payment_id: Optional[str]) -> Optional[str]:
    if not payment_id or not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        return None
    try:
        payment = Payment.find_one(payment_id)
    except Exception:
        return None
    confirmation = getattr(payment, "confirmation", None)
    return getattr(confirmation, "confirmation_url", None)


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


@app.exception_handler(413)
async def request_entity_too_large_handler(request: Request, exc):
    return JSONResponse(status_code=413, content={"detail": "Файл слишком большой"})

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
    c.execute('''
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            currency TEXT NOT NULL DEFAULT 'RUB',
            duration_days INTEGER,
            category_limit INTEGER,
            item_limit INTEGER,
            is_full_access BOOLEAN NOT NULL DEFAULT 0,
            is_trial BOOLEAN NOT NULL DEFAULT 0,
            features TEXT,
            is_hidden BOOLEAN NOT NULL DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS restaurant_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restaurant_id INTEGER NOT NULL,
            plan_code TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            started_at TEXT,
            expires_at TEXT,
            payment_id TEXT,
            amount INTEGER,
            currency TEXT,
            FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
            FOREIGN KEY (plan_code) REFERENCES subscription_plans (code) ON DELETE CASCADE
        )
    ''')
    c.execute("PRAGMA table_info(subscription_plans)")
    subscription_columns = [row[1] for row in c.fetchall()]
    if "is_hidden" not in subscription_columns:
        c.execute("ALTER TABLE subscription_plans ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT 0")
    conn.commit()
    conn.close()


def sync_subscription_plans():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    for plan in SUBSCRIPTION_PLANS_DATA:
        c.execute(
            """
            INSERT INTO subscription_plans (code, name, description, price, currency, duration_days, category_limit, item_limit, is_full_access, is_trial, features, is_hidden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                price = excluded.price,
                currency = excluded.currency,
                duration_days = excluded.duration_days,
                category_limit = excluded.category_limit,
                item_limit = excluded.item_limit,
                is_full_access = excluded.is_full_access,
                is_trial = excluded.is_trial,
                features = excluded.features,
                is_hidden = excluded.is_hidden
            """,
            (
                plan["code"],
                plan["name"],
                plan.get("description"),
                plan.get("price", 0),
                plan.get("currency", "RUB"),
                plan.get("duration_days"),
                plan.get("category_limit"),
                plan.get("item_limit"),
                int(bool(plan.get("is_full_access"))),
                int(bool(plan.get("is_trial"))),
                json.dumps(plan.get("features", [])),
                int(bool(plan.get("is_hidden"))),
            ),
        )
    conn.commit()
    conn.close()


def cleanup_expired_subscriptions():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        UPDATE restaurant_subscriptions
        SET status = 'expired'
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND datetime(expires_at) < datetime('now')
        """
    )
    conn.commit()
    conn.close()


def get_subscription_plan_by_code(code: str) -> Optional[dict]:
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT code, name, description, price, currency, duration_days, category_limit, item_limit, is_full_access, is_trial, features
        FROM subscription_plans
        WHERE code = ?
        """,
        (code,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "code": row[0],
        "name": row[1],
        "description": row[2],
        "price": row[3],
        "currency": row[4],
        "duration_days": row[5],
        "category_limit": row[6],
        "item_limit": row[7],
        "is_full_access": bool(row[8]),
        "is_trial": bool(row[9]),
        "features": json.loads(row[10]) if row[10] else [],
    }


def list_subscription_plans() -> list[dict]:
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT code, name, description, price, currency, duration_days, category_limit, item_limit, is_full_access, is_trial, features
        FROM subscription_plans
        WHERE is_hidden IS NULL OR is_hidden = 0
        ORDER BY id ASC
        """
    )
    rows = c.fetchall()
    conn.close()
    plans: list[dict] = []
    for row in rows:
        plans.append({
            "code": row[0],
            "name": row[1],
            "description": row[2],
            "price": row[3],
            "currency": row[4],
            "duration_days": row[5],
            "category_limit": row[6],
            "item_limit": row[7],
            "is_full_access": bool(row[8]),
            "is_trial": bool(row[9]),
            "features": json.loads(row[10]) if row[10] else [],
        })
    return plans


def create_subscription_record(
    restaurant_id: int,
    plan_code: str,
    status: str,
    amount: int,
    currency: str,
    payment_id: Optional[str] = None,
    started_at: Optional[datetime] = None,
    expires_at: Optional[datetime] = None,
) -> int:
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    created_at = datetime.utcnow()
    c.execute(
        """
        INSERT INTO restaurant_subscriptions (restaurant_id, plan_code, status, created_at, started_at, expires_at, payment_id, amount, currency)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            restaurant_id,
            plan_code,
            status,
            format_datetime(created_at),
            format_datetime(started_at),
            format_datetime(expires_at),
            payment_id,
            amount,
            currency,
        ),
    )
    subscription_id = c.lastrowid
    conn.commit()
    conn.close()
    return subscription_id


def set_subscription_active(
    subscription_id: int,
    restaurant_id: int,
    plan: dict,
    amount: int,
    currency: str,
    payment_id: Optional[str] = None,
):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        "UPDATE restaurant_subscriptions SET status = 'expired' WHERE restaurant_id = ? AND status = 'active' AND id != ?",
        (restaurant_id, subscription_id),
    )
    started = datetime.utcnow()
    expires = None
    if plan.get("duration_days"):
        expires = started + timedelta(days=int(plan["duration_days"]))
    c.execute(
        """
        UPDATE restaurant_subscriptions
        SET status = 'active',
            started_at = ?,
            expires_at = ?,
            amount = ?,
            currency = ?,
            payment_id = ?
        WHERE id = ?
        """,
        (
            format_datetime(started),
            format_datetime(expires),
            amount,
            currency,
            payment_id,
            subscription_id,
        ),
    )
    conn.commit()
    conn.close()


def ensure_base_subscription(restaurant_id: int):
    plan = get_subscription_plan_by_code("base")
    if not plan:
        return
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        "SELECT id FROM restaurant_subscriptions WHERE restaurant_id = ? LIMIT 1",
        (restaurant_id,),
    )
    exists = c.fetchone()
    conn.close()
    if exists:
        return
    started = datetime.utcnow()
    create_subscription_record(
        restaurant_id=restaurant_id,
        plan_code=plan["code"],
        status="active",
        amount=0,
        currency=plan.get("currency", "RUB"),
        started_at=started,
        expires_at=None,
    )


def ensure_base_for_existing_restaurants():
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants")
    restaurant_ids = [row[0] for row in c.fetchall()]
    conn.close()
    for restaurant_id in restaurant_ids:
        ensure_base_subscription(restaurant_id)


def get_active_subscription(restaurant_id: int) -> Optional[dict]:
    cleanup_expired_subscriptions()
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT rs.id, rs.plan_code, rs.status, rs.created_at, rs.started_at, rs.expires_at, rs.payment_id, rs.amount, rs.currency,
               sp.name, sp.description, sp.price, sp.currency, sp.duration_days, sp.category_limit, sp.item_limit, sp.is_full_access, sp.is_trial, sp.features
        FROM restaurant_subscriptions rs
        JOIN subscription_plans sp ON sp.code = rs.plan_code
        WHERE rs.restaurant_id = ? AND rs.status = 'active'
        ORDER BY datetime(COALESCE(rs.expires_at, '9999-12-31 23:59:59')) DESC, rs.id DESC
        LIMIT 1
        """,
        (restaurant_id,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "plan_code": row[1],
        "status": row[2],
        "created_at": row[3],
        "started_at": row[4],
        "expires_at": row[5],
        "payment_id": row[6],
        "amount": row[7],
        "currency": row[8],
        "plan": {
            "name": row[9],
            "description": row[10],
            "price": row[11],
            "currency": row[12],
            "duration_days": row[13],
            "category_limit": row[14],
            "item_limit": row[15],
            "is_full_access": bool(row[16]),
            "is_trial": bool(row[17]),
            "features": json.loads(row[18]) if row[18] else [],
        },
    }


def get_latest_subscription(restaurant_id: int) -> Optional[dict]:
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT rs.id, rs.plan_code, rs.status, rs.created_at, rs.started_at, rs.expires_at, rs.payment_id, rs.amount, rs.currency,
               sp.name, sp.description, sp.price, sp.currency, sp.duration_days, sp.category_limit, sp.item_limit, sp.is_full_access, sp.is_trial, sp.features
        FROM restaurant_subscriptions rs
        JOIN subscription_plans sp ON sp.code = rs.plan_code
        WHERE rs.restaurant_id = ?
        ORDER BY datetime(rs.created_at) DESC, rs.id DESC
        LIMIT 1
        """,
        (restaurant_id,),
    )
    row = c.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0],
        "plan_code": row[1],
        "status": row[2],
        "created_at": row[3],
        "started_at": row[4],
        "expires_at": row[5],
        "payment_id": row[6],
        "amount": row[7],
        "currency": row[8],
        "plan": {
            "name": row[9],
            "description": row[10],
            "price": row[11],
            "currency": row[12],
            "duration_days": row[13],
            "category_limit": row[14],
            "item_limit": row[15],
            "is_full_access": bool(row[16]),
            "is_trial": bool(row[17]),
            "features": json.loads(row[18]) if row[18] else [],
        },
    }


def get_subscription_limits(restaurant_id: int) -> dict:
    active = get_active_subscription(restaurant_id)
    if active:
        plan = active["plan"]
        if plan.get("is_full_access"):
            return {"category_limit": None, "item_limit": None}
        return {
            "category_limit": plan.get("category_limit"),
            "item_limit": plan.get("item_limit"),
        }
    # Без подписки действует базовое ограничение
    return {"category_limit": 3, "item_limit": 5}


def list_restaurant_subscriptions(restaurant_id: int) -> list[dict]:
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT rs.id, rs.plan_code, rs.status, rs.created_at, rs.started_at, rs.expires_at, rs.payment_id, rs.amount, rs.currency,
               sp.name, sp.duration_days, sp.is_full_access
        FROM restaurant_subscriptions rs
        JOIN subscription_plans sp ON sp.code = rs.plan_code
        WHERE rs.restaurant_id = ?
        ORDER BY datetime(rs.created_at) DESC, rs.id DESC
        """,
        (restaurant_id,),
    )
    rows = c.fetchall()
    conn.close()
    history: list[dict] = []
    for row in rows:
        amount_value = row[7] if row[7] is not None else 0
        history.append({
            "id": row[0],
            "plan_code": row[1],
            "status": row[2],
            "created_at": row[3],
            "started_at": row[4],
            "expires_at": row[5],
            "payment_id": row[6],
            "amount_minor": amount_value,
            "amount": (amount_value or 0) / 100 if amount_value else 0,
            "currency": row[8] or "RUB",
            "plan_name": row[9],
            "duration_days": row[10],
            "is_full_access": bool(row[11]),
        })
    return history


def format_subscription_payload(subscription: Optional[dict]) -> Optional[dict]:
    if not subscription:
        return None
    amount_minor = subscription.get("amount") or 0
    plan = subscription.get("plan", {})
    currency = subscription.get("currency") or plan.get("currency", "RUB")
    return {
        "plan_code": subscription.get("plan_code"),
        "plan_name": plan.get("name"),
        "status": subscription.get("status"),
        "started_at": subscription.get("started_at"),
        "expires_at": subscription.get("expires_at"),
        "amount": (amount_minor or 0) / 100 if amount_minor else 0,
        "currency": currency,
    }


def format_plan_response(plan: dict) -> dict:
    price_minor = plan.get("price") or 0
    return {
        "code": plan.get("code"),
        "name": plan.get("name"),
        "description": plan.get("description"),
        "price": price_minor / 100 if price_minor else 0,
        "price_minor": price_minor,
        "currency": plan.get("currency", "RUB"),
        "duration_days": plan.get("duration_days"),
        "category_limit": plan.get("category_limit"),
        "item_limit": plan.get("item_limit"),
        "is_full_access": plan.get("is_full_access"),
        "is_trial": plan.get("is_trial"),
        "features": plan.get("features", []),
    }

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
sync_subscription_plans()
cleanup_expired_subscriptions()
ensure_base_for_existing_restaurants()


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


class RestaurantSubscriptionInfo(BaseModel):
    plan_code: str
    plan_name: str
    status: str
    started_at: Optional[str] = None
    expires_at: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None


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
    qr_code: Optional[str] = None
    subdomain: Optional[str] = None
    subscription: Optional[RestaurantSubscriptionInfo] = None

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


class CreateSubscriptionRequest(BaseModel):
    plan_code: str
    return_url: Optional[str] = None


class RefreshSubscriptionRequest(BaseModel):
    payment_id: str


class CancelSubscriptionRequest(BaseModel):
    payment_id: Optional[str] = None

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


class CreateTestingUserRequest(BaseModel):
    token: Optional[str] = None
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    restaurant_name: Optional[str] = None

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


@app.post("/api/admin/testing-users")
def create_testing_user(req: CreateTestingUserRequest):
    if TESTING_USERS_TOKEN and req.token != TESTING_USERS_TOKEN:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    email = req.email.lower()
    conn = sqlite3.connect("users.db")
    c = conn.cursor()

    c.execute("SELECT email FROM users WHERE email = ?", (email,))
    existing = c.fetchone()
    created_user = False

    if existing:
        updates = []
        values: List[str] = []
        if req.first_name is not None:
            updates.append("first_name = ?")
            values.append(req.first_name)
        if req.last_name is not None:
            updates.append("last_name = ?")
            values.append(req.last_name)
        if req.password:
            updates.append("password_hash = ?")
            values.append(hash_password(req.password))
        if updates:
            values.append(email)
            query = f"UPDATE users SET {', '.join(updates)} WHERE email = ?"
            c.execute(query, tuple(values))
    else:
        c.execute(
            """
            INSERT INTO users (email, password_hash, verified, first_name, last_name, photo, phone, payment_method_type, payment_method_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                email,
                hash_password(req.password),
                True,
                req.first_name,
                req.last_name,
                None,
                None,
                None,
                None,
            ),
        )
        created_user = True

    conn.commit()

    c.execute(
        "SELECT id FROM restaurants WHERE owner_email = ? ORDER BY id ASC",
        (email,),
    )
    restaurant_rows = c.fetchall()

    if not restaurant_rows:
        name_value = req.restaurant_name or "Моё заведение"
        c.execute(
            """
            INSERT INTO restaurants (owner_email, photo, name, description, city, address, hours, instagram, telegram, vk, whatsapp, features, type, phone, subdomain)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                email,
                None,
                name_value,
                "Описание заведения",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ),
        )
        restaurant_rows = [(c.lastrowid,)]

    conn.commit()
    conn.close()

    plan = get_subscription_plan_by_code("testing")
    if not plan:
        raise HTTPException(status_code=500, detail="Тариф 'тестирование' не найден")

    applied: List[int] = []
    for (restaurant_id,) in restaurant_rows:
        ensure_base_subscription(restaurant_id)
        active = get_active_subscription(restaurant_id)
        if active and active.get("plan_code") == plan["code"]:
            applied.append(restaurant_id)
            continue
        subscription_id = create_subscription_record(
            restaurant_id=restaurant_id,
            plan_code=plan["code"],
            status="active",
            amount=0,
            currency=plan.get("currency", "RUB"),
            started_at=datetime.utcnow(),
            expires_at=None,
        )
        set_subscription_active(
            subscription_id=subscription_id,
            restaurant_id=restaurant_id,
            plan=plan,
            amount=0,
            currency=plan.get("currency", "RUB"),
            payment_id=None,
        )
        applied.append(restaurant_id)

    return {
        "email": email,
        "created_user": created_user,
        "plan_code": plan["code"],
        "restaurants": applied,
    }

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
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    c.execute("SELECT photo FROM users WHERE email = ?", (current_user["email"],))
    user_row = c.fetchone()
    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    delete_uploaded_file(user_row[0])

    c.execute(
        "SELECT id, photo FROM restaurants WHERE owner_email = ?",
        (current_user["email"],),
    )
    restaurant_rows = c.fetchall()
    restaurant_ids = [row[0] for row in restaurant_rows]

    for _, photo in restaurant_rows:
        delete_uploaded_file(photo)

    if restaurant_ids:
        placeholders = ",".join("?" for _ in restaurant_ids)
        params = tuple(restaurant_ids)

        c.execute(
            f"SELECT photo FROM menu_categories WHERE restaurant_id IN ({placeholders})",
            params,
        )
        for (photo,) in c.fetchall():
            delete_uploaded_file(photo)

        c.execute(
            f"""
            SELECT mi.photo
            FROM menu_items mi
            JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mc.restaurant_id IN ({placeholders})
        """,
            params,
        )
        for (photo,) in c.fetchall():
            delete_uploaded_file(photo)

    c.execute("DELETE FROM codes WHERE email = ?", (current_user["email"],))
    c.execute("DELETE FROM users WHERE email = ?", (current_user["email"],))

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
    ensure_base_subscription(restaurant_id)
    if req.subdomain:
        generate_qr_for_restaurant(restaurant_id, req.subdomain)
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
        subscription = get_active_subscription(row[0]) or get_latest_subscription(row[0])
        restaurants.append({
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
            "subdomain": row[14],
            "qr_code": get_qr_url(row[0]),
            "subscription": format_subscription_payload(subscription),
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
    subscription = get_active_subscription(row[0]) or get_latest_subscription(row[0])

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
        "subdomain": row[14],
        "qr_code": get_qr_url(row[0]),
        "subscription": format_subscription_payload(subscription),
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
    c.execute(
        "SELECT subdomain FROM restaurants WHERE id = ? AND owner_email = ?",
        (restaurant_id, current_user["email"]),
    )
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Заведение не найдено")
    previous_subdomain = (row[0] or "").strip()
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
    if req.subdomain is not None:
        new_subdomain = req.subdomain.strip()
        if new_subdomain:
            generate_qr_for_restaurant(restaurant_id, new_subdomain)
        if not new_subdomain and previous_subdomain:
            remove_qr_for_restaurant(restaurant_id)
    return {"message": "Обновлено"}


@app.delete("/api/restaurants/{restaurant_id}")
def delete_restaurant(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect("users.db")
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    c.execute(
        "SELECT id, photo FROM restaurants WHERE id = ? AND owner_email = ?",
        (restaurant_id, current_user["email"]),
    )
    restaurant = c.fetchone()
    if not restaurant:
        conn.close()
        raise HTTPException(status_code=404, detail="Заведение не найдено")

    c.execute(
        "SELECT COUNT(*) FROM restaurants WHERE owner_email = ?",
        (current_user["email"],),
    )
    total_restaurants = c.fetchone()[0] or 0
    if total_restaurants <= 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Нельзя удалить единственное заведение")

    delete_uploaded_file(restaurant[1])

    c.execute(
        "SELECT id, photo FROM menu_categories WHERE restaurant_id = ?",
        (restaurant_id,),
    )
    categories = c.fetchall()
    category_ids = [row[0] for row in categories]
    for _, photo in categories:
        delete_uploaded_file(photo)

    if category_ids:
        placeholders = ",".join("?" for _ in category_ids)
        c.execute(
            f"SELECT photo FROM menu_items WHERE category_id IN ({placeholders})",
            tuple(category_ids),
        )
        for (photo,) in c.fetchall():
            delete_uploaded_file(photo)

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

    limits = get_subscription_limits(restaurant_id)
    category_limit = limits.get("category_limit")
    if category_limit is not None:
        c.execute("SELECT COUNT(*) FROM menu_categories WHERE restaurant_id = ?", (restaurant_id,))
        count_row = c.fetchone()
        existing_count = count_row[0] if count_row else 0
        if existing_count >= category_limit:
            conn.close()
            raise HTTPException(
                status_code=403,
                detail="Достигнут лимит категорий для текущей подписки. Оформите подписку с полным доступом, чтобы добавить больше категорий.",
            )

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
async def create_menu_item(
    restaurant_id: int,
    category_id: int,
    current_user: dict = Depends(get_current_user),
    name: str = Form(...),
    price: float = Form(...),
    description: Optional[str] = Form(None),
    calories: Optional[int] = Form(None),
    proteins: Optional[float] = Form(None),
    fats: Optional[float] = Form(None),
    carbs: Optional[float] = Form(None),
    weight: Optional[float] = Form(None),
    view: Optional[bool] = Form(True),
    placenum: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None),
):
    conn = sqlite3.connect("users.db")
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, current_user["email"]))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")

    c.execute("SELECT id FROM menu_categories WHERE id = ? AND restaurant_id = ?", (category_id, restaurant_id))
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Категория не найдена")

    limits = get_subscription_limits(restaurant_id)
    item_limit = limits.get("item_limit")
    if item_limit is not None:
        c.execute("SELECT COUNT(*) FROM menu_items WHERE category_id = ?", (category_id,))
        count_row = c.fetchone()
        existing_items = count_row[0] if count_row else 0
        if existing_items >= item_limit:
            conn.close()
            raise HTTPException(
                status_code=403,
                detail="Достигнут лимит блюд в этой категории. Оформите премиум подписку, чтобы добавить больше блюд.",
            )

    if placenum is None:
        c.execute("SELECT MAX(placenum) FROM menu_items WHERE category_id = ?", (category_id,))
        max_placenum = c.fetchone()[0] or 0
        placenum_value = max_placenum + 1
    else:
        placenum_value = placenum

    if isinstance(view, str):
        view_value = view.lower() in {"true", "1", "yes", "on"}
    else:
        view_value = True if view is None else bool(view)

    photo_filename: Optional[str] = None
    if photo is not None:
        if not photo.content_type or not photo.content_type.startswith("image/"):
            conn.close()
            raise HTTPException(status_code=400, detail="Только изображения разрешены")
        safe_name = Path(photo.filename).name
        photo_filename = f"menu_item_{category_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{safe_name}"
        file_path = UPLOAD_DIR / photo_filename
        try:
            with open(file_path, "wb") as f:
                f.write(await photo.read())
        except Exception as exc:
            delete_uploaded_file(photo_filename)
            conn.close()
            raise HTTPException(status_code=500, detail="Не удалось сохранить фото") from exc

    stored_photo = photo_filename or DEFAULT_MENU_ITEM_PHOTO

    try:
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
                stored_photo,
                int(bool(view_value)),
                placenum_value,
            ),
        )
        item_id = c.lastrowid
        conn.commit()
    except Exception as exc:
        conn.rollback()
        if photo_filename:
            delete_uploaded_file(photo_filename)
        conn.close()
        raise HTTPException(status_code=500, detail="Не удалось создать блюдо") from exc

    c.execute(
        """
        SELECT id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum
        FROM menu_items WHERE id = ?
    """,
        (item_id,),
    )
    row = c.fetchone()
    conn.close()

    if not row:
        if photo_filename:
            delete_uploaded_file(photo_filename)
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


@app.post("/api/restaurants/{restaurant_id}/menu/import-csv")
async def import_menu_from_csv(
    restaurant_id: int,
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

    c.execute(
        "SELECT id FROM restaurants WHERE id = ? AND owner_email = ?",
        (restaurant_id, current_user["email"]),
    )
    if not c.fetchone():
        conn.close()
        raise HTTPException(404, "Заведение не найдено")

    limits = get_subscription_limits(restaurant_id)
    category_limit = limits.get("category_limit")
    item_limit = limits.get("item_limit")

    c.execute(
        """
        SELECT id, name, description, placenum
        FROM menu_categories
        WHERE restaurant_id = ?
        ORDER BY placenum ASC
        """,
        (restaurant_id,),
    )
    category_rows = c.fetchall()

    existing_categories: dict[str, dict] = {}
    current_category_count = len(category_rows)
    next_category_placenum = 0
    for row in category_rows:
        name_value = (row[1] or "").strip()
        if name_value:
            existing_categories[name_value.lower()] = {
                "id": row[0],
                "name": name_value,
                "description": row[2],
                "placenum": row[3] or 0,
            }
        if row[3] and row[3] > next_category_placenum:
            next_category_placenum = row[3]

    category_item_counters: dict[int, dict[str, int]] = {}
    if category_rows:
        category_ids = [row[0] for row in category_rows]
        placeholders = ",".join("?" for _ in category_ids)
        c.execute(
            f"SELECT category_id, COUNT(*), MAX(placenum) FROM menu_items WHERE category_id IN ({placeholders}) GROUP BY category_id",
            tuple(category_ids),
        )
        for count_row in c.fetchall():
            category_item_counters[count_row[0]] = {
                "count": count_row[1] or 0,
                "placenum": count_row[2] or 0,
            }
    for row in category_rows:
        if row[0] not in category_item_counters:
            category_item_counters[row[0]] = {"count": 0, "placenum": 0}

    existing_items: dict[int, dict[str, tuple[int, Optional[str]]]] = {}
    c.execute(
        """
        SELECT mi.id, mi.category_id, mi.name, mi.photo
        FROM menu_items mi
        JOIN menu_categories mc ON mc.id = mi.category_id
        WHERE mc.restaurant_id = ?
        """,
        (restaurant_id,),
    )
    for item_row in c.fetchall():
        item_name = (item_row[2] or "").strip().lower()
        if not item_name:
            continue
        existing_items.setdefault(item_row[1], {})[item_name] = (item_row[0], item_row[3])

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
    photo_keys = ["photo", "фото", "изображение", "картинка", "image_url", "image"]
    category_name_keys = [
        "category",
        "категория",
        "category_name",
        "название категории",
    ]
    category_description_keys = [
        "category_description",
        "описание категории",
        "описание кат",
    ]

    for index, row in enumerate(reader, start=2):
        normalized = normalize_row(row)

        category_name = get_value(normalized, category_name_keys)
        if not category_name:
            errors.append(f"Строка {index}: отсутствует название категории")
            continue
        category_clean = category_name.strip()
        category_key = category_clean.lower()
        category_description = get_value(normalized, category_description_keys)

        if category_key in existing_categories:
            category_info = existing_categories[category_key]
            category_id = category_info["id"]
            if category_description and category_description != (category_info.get("description") or ""):
                c.execute(
                    "UPDATE menu_categories SET description = ? WHERE id = ?",
                    (category_description, category_id),
                )
                category_info["description"] = category_description
        else:
            if category_limit is not None and current_category_count >= category_limit:
                errors.append(
                    f"Строка {index}: превышен лимит категорий для текущей подписки"
                )
                continue
            description_value = category_description
            if description_value is None:
                for template in MENU_CATEGORIES:
                    if template["name"].lower() == category_clean.lower():
                        description_value = template["description"]
                        break
            next_category_placenum += 1
            c.execute(
                """
                INSERT INTO menu_categories (restaurant_id, photo, name, description, placenum)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    restaurant_id,
                    None,
                    category_clean,
                    description_value,
                    next_category_placenum,
                ),
            )
            category_id = c.lastrowid
            existing_categories[category_key] = {
                "id": category_id,
                "name": category_clean,
                "description": description_value,
                "placenum": next_category_placenum,
            }
            category_item_counters[category_id] = {"count": 0, "placenum": 0}
            existing_items[category_id] = {}
            current_category_count += 1

        category_id = existing_categories[category_key]["id"]
        name_value = get_value(normalized, name_keys)
        if not name_value:
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

        photo_raw = get_value(normalized, photo_keys)
        if isinstance(photo_raw, str):
            photo_value = photo_raw.strip() or None
        else:
            photo_value = None

        bju_value = get_value(normalized, bju_keys)
        if bju_value and (proteins is None or fats is None or carbs is None):
            parts = [
                part.strip()
                for part in csv.reader([bju_value.replace("/", ",")], delimiter=",").__next__()
            ]
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

        item_key = name_value.strip().lower()
        category_items = existing_items.setdefault(category_id, {})
        existing_item = category_items.get(item_key)

        if existing_item:
            item_id, photo = existing_item
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
            if photo_value:
                c.execute(
                    "UPDATE menu_items SET photo = ? WHERE id = ?",
                    (photo_value, item_id),
                )
                category_items[item_key] = (item_id, photo_value)
            elif not photo:
                c.execute(
                    "UPDATE menu_items SET photo = ? WHERE id = ?",
                    (DEFAULT_MENU_ITEM_PHOTO, item_id),
                )
                category_items[item_key] = (item_id, DEFAULT_MENU_ITEM_PHOTO)
            else:
                category_items[item_key] = (item_id, photo)
            updated += 1
        else:
            counters = category_item_counters.setdefault(category_id, {"count": 0, "placenum": 0})
            if item_limit is not None and counters["count"] >= item_limit:
                errors.append(
                    f"Строка {index}: превышен лимит блюд для текущей подписки"
                )
                continue
            counters["placenum"] += 1
            stored_photo = photo_value or DEFAULT_MENU_ITEM_PHOTO
            c.execute(
                """
                INSERT INTO menu_items (category_id, name, price, description, calories, proteins, fats, carbs, weight, photo, view, placenum)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    name_value,
                    price,
                    description,
                    calories,
                    proteins,
                    fats,
                    carbs,
                    weight,
                    stored_photo,
                    int(view),
                    counters["placenum"],
                ),
            )
            new_id = c.lastrowid
            counters["count"] += 1
            category_items[item_key] = (new_id, stored_photo)
            created += 1

    conn.commit()
    conn.close()

    menu_data = get_full_menu(restaurant_id)

    return {
        "created": created,
        "updated": updated,
        "errors": errors,
        "categories": menu_data.get("categories", []),
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


@app.get("/api/subscriptions/plans")
def get_subscription_plans(current_user: dict = Depends(get_current_user)):
    plans = [format_plan_response(plan) for plan in list_subscription_plans()]
    return {"plans": plans}


def ensure_restaurant_access(restaurant_id: int, owner_email: str):
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute("SELECT id FROM restaurants WHERE id = ? AND owner_email = ?", (restaurant_id, owner_email))
    exists = c.fetchone()
    conn.close()
    if not exists:
        raise HTTPException(status_code=404, detail="Заведение не найдено")


@app.get("/api/restaurants/{restaurant_id}/subscription")
def get_restaurant_subscription(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    ensure_restaurant_access(restaurant_id, current_user["email"])
    latest = get_latest_subscription(restaurant_id)
    subscription = get_active_subscription(restaurant_id) or latest
    pending_payment = None
    if latest and latest.get("status") == "pending":
        pending_payment = {
            "subscription_id": latest.get("id"),
            "plan_code": latest.get("plan_code"),
            "plan_name": latest.get("plan", {}).get("name") if latest.get("plan") else None,
            "payment_id": latest.get("payment_id"),
            "confirmation_url": get_payment_confirmation_url(latest.get("payment_id")),
        }
    return {
        "subscription": format_subscription_payload(subscription),
        "limits": get_subscription_limits(restaurant_id),
        "pending_payment": pending_payment,
    }


@app.get("/api/restaurants/{restaurant_id}/subscription/history")
def get_restaurant_subscription_history(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    ensure_restaurant_access(restaurant_id, current_user["email"])
    history = list_restaurant_subscriptions(restaurant_id)
    return {"history": history}


@app.post("/api/restaurants/{restaurant_id}/subscription")
def create_restaurant_subscription(
    restaurant_id: int,
    req: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    plan_code = req.plan_code.strip().lower()
    plan = get_subscription_plan_by_code(plan_code)
    if not plan:
        raise HTTPException(status_code=404, detail="Тариф не найден")

    ensure_restaurant_access(restaurant_id, current_user["email"])

    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT id, payment_id, plan_code
        FROM restaurant_subscriptions
        WHERE restaurant_id = ? AND status = 'pending'
        ORDER BY datetime(created_at) DESC, id DESC
        LIMIT 1
        """,
        (restaurant_id,),
    )
    pending_row = c.fetchone()
    if pending_row:
        subscription_id, payment_id, pending_plan_code = pending_row
        conn.close()
        plan = get_subscription_plan_by_code(pending_plan_code)
        return {
            "status": "pending",
            "subscription_id": subscription_id,
            "payment_id": payment_id,
            "confirmation_url": get_payment_confirmation_url(payment_id),
            "existing": True,
            "plan_code": pending_plan_code,
            "plan_name": plan.get("name") if plan else None,
        }
    conn.close()

    active = get_active_subscription(restaurant_id)
    if plan.get("is_trial") and active and active.get("plan_code") == plan_code:
        raise HTTPException(status_code=400, detail="Пробная подписка уже активна")

    amount_minor = plan.get("price", 0) or 0
    currency = plan.get("currency", "RUB")

    if amount_minor <= 0:
        subscription_id = create_subscription_record(
            restaurant_id=restaurant_id,
            plan_code=plan_code,
            status="pending",
            amount=amount_minor,
            currency=currency,
        )
        set_subscription_active(
            subscription_id=subscription_id,
            restaurant_id=restaurant_id,
            plan=plan,
            amount=amount_minor,
            currency=currency,
        )
        subscription = get_active_subscription(restaurant_id)
        return {
            "status": "active",
            "subscription": format_subscription_payload(subscription),
            "limits": get_subscription_limits(restaurant_id),
        }

    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        raise HTTPException(status_code=500, detail="Платежный сервис временно недоступен")

    try:
        payment = Payment.create(
            {
                "amount": {"value": "{:.2f}".format(amount_minor / 100), "currency": currency},
                "description": f"Подписка {plan['name']} для заведения #{restaurant_id}",
                "confirmation": {
                    "type": "redirect",
                    "return_url": req.return_url or YOOKASSA_RETURN_URL,
                },
                "capture": True,
                "metadata": {
                    "restaurant_id": restaurant_id,
                    "plan_code": plan_code,
                },
            },
            uuid4().hex,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Не удалось создать платеж") from exc

    subscription_id = create_subscription_record(
        restaurant_id=restaurant_id,
        plan_code=plan_code,
        status="pending",
        amount=amount_minor,
        currency=currency,
        payment_id=payment.id,
    )

    confirmation_url = None
    if getattr(payment, "confirmation", None):
        confirmation_url = getattr(payment.confirmation, "confirmation_url", None)

    return {
        "status": "pending",
        "payment_id": payment.id,
        "subscription_id": subscription_id,
        "confirmation_url": confirmation_url,
        "plan_code": plan_code,
        "plan_name": plan.get("name") if plan else None,
        "existing": False,
    }


@app.post("/api/restaurants/{restaurant_id}/subscription/grant-trial")
def grant_trial_subscription(restaurant_id: int, current_user: dict = Depends(get_current_user)):
    ensure_restaurant_access(restaurant_id, current_user["email"])
    plan = get_subscription_plan_by_code("trial")
    if not plan:
        raise HTTPException(status_code=404, detail="Пробная подписка недоступна")

    active = get_active_subscription(restaurant_id)
    if active and active.get("plan_code") not in {"base", "trial"}:
        raise HTTPException(status_code=400, detail="Нельзя заменить активную платную подписку")

    subscription_id = create_subscription_record(
        restaurant_id=restaurant_id,
        plan_code=plan["code"],
        status="pending",
        amount=0,
        currency=plan.get("currency", "RUB"),
    )
    set_subscription_active(
        subscription_id=subscription_id,
        restaurant_id=restaurant_id,
        plan=plan,
        amount=0,
        currency=plan.get("currency", "RUB"),
    )

    subscription = get_active_subscription(restaurant_id)
    return {
        "status": "active",
        "subscription": format_subscription_payload(subscription),
        "limits": get_subscription_limits(restaurant_id),
    }


@app.post("/api/restaurants/{restaurant_id}/subscription/cancel")
def cancel_restaurant_subscription(
    restaurant_id: int,
    req: CancelSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    ensure_restaurant_access(restaurant_id, current_user["email"])
    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    if req.payment_id:
        c.execute(
            """
            SELECT id, payment_id
            FROM restaurant_subscriptions
            WHERE restaurant_id = ? AND status = 'pending' AND payment_id = ?
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 1
            """,
            (restaurant_id, req.payment_id),
        )
    else:
        c.execute(
            """
            SELECT id, payment_id
            FROM restaurant_subscriptions
            WHERE restaurant_id = ? AND status = 'pending'
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 1
            """,
            (restaurant_id,),
        )
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Нет неоплаченной подписки")

    subscription_id, payment_id = row
    if payment_id and YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY:
        try:
            Payment.cancel(payment_id)
        except Exception:
            pass

    c.execute(
        "UPDATE restaurant_subscriptions SET status = 'canceled' WHERE id = ?",
        (subscription_id,),
    )
    conn.commit()
    conn.close()
    return {"status": "canceled"}


@app.post("/api/restaurants/{restaurant_id}/subscription/refresh")
def refresh_restaurant_subscription(
    restaurant_id: int,
    req: RefreshSubscriptionRequest,
    current_user: dict = Depends(get_current_user),
):
    ensure_restaurant_access(restaurant_id, current_user["email"])
    if not req.payment_id:
        raise HTTPException(status_code=400, detail="Не указан идентификатор платежа")

    conn = sqlite3.connect("users.db")
    c = conn.cursor()
    c.execute(
        """
        SELECT id, plan_code, amount, currency, status
        FROM restaurant_subscriptions
        WHERE restaurant_id = ? AND payment_id = ?
        ORDER BY id DESC
        LIMIT 1
        """,
        (restaurant_id, req.payment_id),
    )
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Платеж не найден")

    subscription_id, plan_code, amount_minor, currency, status = row
    if status == "active":
        conn.close()
        subscription = get_active_subscription(restaurant_id)
        return {
            "status": "active",
            "subscription": format_subscription_payload(subscription),
            "limits": get_subscription_limits(restaurant_id),
        }

    if not (YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY):
        conn.close()
        raise HTTPException(status_code=500, detail="Платежный сервис временно недоступен")

    try:
        payment = Payment.find_one(req.payment_id)
    except Exception as exc:
        conn.close()
        raise HTTPException(status_code=502, detail="Не удалось получить статус платежа") from exc

    payment_status = getattr(payment, "status", None)

    if payment_status == "succeeded":
        plan = get_subscription_plan_by_code(plan_code)
        if not plan:
            conn.close()
            raise HTTPException(status_code=404, detail="Тариф не найден")
        conn.close()
        set_subscription_active(
            subscription_id=subscription_id,
            restaurant_id=restaurant_id,
            plan=plan,
            amount=amount_minor or plan.get("price", 0) or 0,
            currency=currency or plan.get("currency", "RUB"),
            payment_id=req.payment_id,
        )
        subscription = get_active_subscription(restaurant_id)
        return {
            "status": "active",
            "subscription": format_subscription_payload(subscription),
            "limits": get_subscription_limits(restaurant_id),
        }

    if payment_status == "canceled":
        c.execute(
            "UPDATE restaurant_subscriptions SET status = 'canceled' WHERE id = ?",
            (subscription_id,),
        )
        conn.commit()
        conn.close()
        return {"status": "canceled"}

    conn.close()
    return {"status": payment_status or "pending"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8003)