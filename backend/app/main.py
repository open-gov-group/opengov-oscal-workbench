from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import routes_sdm, routes_files, routes_resilience, routes_mapping


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenGov OSCAL Workbench API",
        version="0.1.0"
    )

    # CORS fürs Frontend (lokal)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {
            "message": "OpenGov OSCAL Workbench API",
            "docs": "/docs",
            "endpoints": [
                "/api/sdm/controls",
                "/api/files/{name}",
                "/api/save"
            ]
        }

    app.include_router(routes_sdm.router)
    app.include_router(routes_files.router)
    app.include_router(routes_resilience.router)
    app.include_router(routes_mapping.router)

    return app


app = create_app()
