FROM python:3.12-slim

WORKDIR /workspace

COPY packages/enhancer-sdk /workspace/packages/enhancer-sdk
RUN pip install --no-cache-dir pytest /workspace/packages/enhancer-sdk

CMD ["python", "--version"]
