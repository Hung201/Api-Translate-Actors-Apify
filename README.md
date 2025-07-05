# API Translate Actors - MVC Architecture

Dự án dịch thuật dữ liệu từ Apify với kiến trúc MVC (Model-View-Controller).

## Cấu trúc thư mục

```
api-translate-actors/
├── src/
│   ├── controllers/
│   │   └── TranslateController.js    # Xử lý HTTP requests
│   ├── services/
│   │   └── AlibabaService.js         # Logic nghiệp vụ dịch thuật
│   ├── routes/
│   │   └── translateRoutes.js        # Định tuyến API
│   ├── utils/
│   │   └── logger.js                 # Utility logging
│   └── app.js                        # Cấu hình Express app
├── server.js                         # Entry point
├── package.json
└── README.md
```

## Cài đặt

```bash
npm install
```

## Chạy ứng dụng

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

## API Endpoints

### 1. Dịch thuật dữ liệu
- **URL**: `/api/translate`
- **Method**: `POST` hoặc `GET`
- **Body** (POST):
```json
{
    "url": "https://api.apify.com/v2/acts/your-act-id/runs/latest/dataset/download"
}
```
- **Query** (GET): `?url=https://api.apify.com/v2/acts/your-act-id/runs/latest/dataset/download`

### 2. Kiểm tra trạng thái API
- **URL**: `/api/status`
- **Method**: `GET`

### 3. Health check
- **URL**: `/health`
- **Method**: `GET`

## Kiến trúc MVC

### Controller (TranslateController)
- Xử lý HTTP requests và responses
- Validation input
- Gọi service để thực hiện logic nghiệp vụ
- Trả về response cho client

### Service (AlibabaService)
- Chứa logic nghiệp vụ chính
- Xử lý dịch thuật batch
- Tương tác với API bên ngoài
- Lưu trữ dữ liệu

### Model (TranslationModel)
- Định nghĩa cấu trúc dữ liệu
- Validation dữ liệu
- Chuyển đổi dữ liệu

### Routes
- Định nghĩa các endpoint
- Mapping URL với controller methods

## Lợi ích của kiến trúc MVC

1. **Tách biệt trách nhiệm**: Mỗi layer có nhiệm vụ riêng biệt
2. **Dễ bảo trì**: Code được tổ chức rõ ràng, dễ tìm và sửa
3. **Dễ mở rộng**: Có thể thêm tính năng mới mà không ảnh hưởng code cũ
4. **Dễ test**: Có thể test từng component riêng biệt
5. **Tái sử dụng**: Service có thể được sử dụng bởi nhiều controller

## Backup dữ liệu

Dữ liệu đã dịch được lưu trong thư mục `backup_translations/` với:
- File timestamp: `data_alibaba_translated_YYYY-MM-DDTHH-mm-ss-sssZ.json`
- File latest: `latest_translation.json`

## Environment Variables

- `PORT`: Port server (mặc định: 3000)
- `NODE_ENV`: Environment (development/production) 