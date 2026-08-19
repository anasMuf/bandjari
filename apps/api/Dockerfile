# syntax=docker/dockerfile:1

# ---------- build ----------
FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api .

# ---------- runtime ----------
FROM alpine:3.22
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/api /app/api
EXPOSE 8080
USER nobody
ENTRYPOINT ["/app/api"]
