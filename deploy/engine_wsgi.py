"""External production entrypoint. Upstream source remains intact."""
from app import create_app
from app.config import Config
errors = Config.validate()
if errors:
    raise RuntimeError('Engine environment validation failed: ' + '; '.join(errors))
app = create_app()
