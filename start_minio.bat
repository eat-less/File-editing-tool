@echo off
title MinIO Server

set MINIO_ROOT_USER=admin
set MINIO_ROOT_PASSWORD=12345678

echo ========================================
echo   MinIO Server
echo ========================================
echo   Data : D:\dateV1
echo   API  : 9000
echo   Console: 9001
echo   User : admin / 12345678
echo ========================================

"C:\minio\minio.exe" server D:\dateV1 --console-address :9001

pause
