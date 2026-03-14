# Flood Detection API Backend

Professional FastAPI backend for flood detection and analysis.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
# Copy example env file
copy .env.example .env

# Edit .env and add your GEMINI_API_KEY
```

### 3. Run the Server
```bash
# Option 1: Direct run
python main.py

# Option 2: Using uvicorn
uvicorn main:app --reload --port 8000

# Option 3: Using start script
python start.py
```

### 4. Access API Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## 📁 Project Structure

```
backend/
├── config/              # Configuration management
│   ├── __init__.py
│   └── settings.py      # Centralized settings with Pydantic
├── models/              # Data models
│   ├── __init__.py
│   └── schemas.py       # Pydantic models for validation
├── routes/              # API endpoints
│   ├── __init__.py
│   ├── health.py        # Health check endpoints
│   ├── analysis.py      # Flood analysis endpoints
│   └── reports.py       # CRUD endpoints for reports
├── services/            # Business logic
│   ├── __init__.py
│   ├── flood_service.py      # CRUD operations
│   └── analysis_service.py   # Analysis logic
├── .env                 # Environment variables (not in git)
├── .env.example         # Example environment file
├── main.py              # FastAPI application
├── start.py             # Startup script
└── requirements.txt     # Python dependencies
```

## 🔧 API Endpoints

### Health Check
- `GET /` - Health check

### Analysis
- `POST /api/v1/analysis/` - Analyze flood risk

### Reports (CRUD)
- `POST /api/v1/reports/` - Create report
- `GET /api/v1/reports/` - List all reports
- `GET /api/v1/reports/{id}` - Get specific report
- `PUT /api/v1/reports/{id}` - Update report
- `DELETE /api/v1/reports/{id}` - Delete report

## 🏗️ Architecture

### Layered Architecture
1. **Routes Layer** - HTTP endpoints and request handling
2. **Services Layer** - Business logic and data processing
3. **Models Layer** - Data validation and serialization
4. **Config Layer** - Application configuration

### Benefits
- ✅ Separation of concerns
- ✅ Easy to test
- ✅ Scalable and maintainable
- ✅ Type-safe with Pydantic
- ✅ Auto-generated API docs

## 🔒 Security Best Practices

1. **Environment Variables** - Sensitive data in .env
2. **CORS Configuration** - Controlled origins
3. **Input Validation** - Pydantic models
4. **Type Safety** - Full type hints
5. **Error Handling** - Proper HTTP exceptions

## 📝 Example Usage

### Create a Report
```bash
curl -X POST "http://localhost:8000/api/v1/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Downtown",
    "description": "Heavy flooding observed",
    "severity": "high",
    "coordinate": {"lat": 40.7128, "lon": -74.0060}
  }'
```

### Get All Reports
```bash
curl "http://localhost:8000/api/v1/reports/"
```

## 🔄 Next Steps

1. **Database Integration** - Replace in-memory storage with PostgreSQL/MongoDB
2. **Authentication** - Add JWT authentication
3. **Caching** - Implement Redis for caching
4. **Testing** - Add pytest tests
5. **Docker** - Containerize the application
