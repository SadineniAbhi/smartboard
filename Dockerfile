FROM python:3.12-slim

# Install uv
RUN pip install --no-cache-dir uv

# Set working directory
WORKDIR /app

# Copy the full repo into the container
COPY . .

# Install dependencies from pyproject.toml in /app
RUN uv sync --frozen

# Move to the backend directory where app.py lives
WORKDIR /app/backend

# Expose the port expected by Google Cloud Run
EXPOSE 8080

# Run the Flask app
CMD ["uv", "run", "app.py"]
