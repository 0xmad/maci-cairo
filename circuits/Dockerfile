FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:${PATH}"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgmp-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf \
    https://docs.swmansion.com/scarb/install.sh | sh \
    && scarb --version

RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir garaga

WORKDIR /workspace

ENTRYPOINT ["garaga"]
