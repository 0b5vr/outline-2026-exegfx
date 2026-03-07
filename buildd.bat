@echo off
setlocal
cd %~dp0

call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" amd64_x86
msbuild blossom.sln /p:Configuration=Debug
.\Debug\blossom.exe