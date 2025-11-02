# ASS (Awesome Smart Switch Server)
## How to run
1. clone repo
```shell
git clone git@github.com:4Nanai/awesome-smartsw-server.git && cd awesome-smartsw-server
```
2. install packages
```shell
npm install
```
3. copy env file
```shell
cp .env.example .env
```
4. start server
```shell
npm run dev
```

## Websocket Message Body
### Endpoint to Server
#### MESSAGE_TYPE
1. `device_register`
```json
{
  "type": "device_register",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "token": "Device binding token"
  }
}
```
2. `data_report`
```json
{
  "type": "data_report",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "sensor": [
      {
        "type": "Sensor type",
        "data": "Sensor data"
      },
      {
        ...
      }
    ]
  }
}
```
3. `command`
```json
{
  "type": "command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "Command type",
      "data": "Command data"
    }
  }
}
```
4. `others` (Customized)

### Server to Endpoint
#### MESSAGE_TYPE
1. `auth_success`
```json
{
  "type": "auth_success",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address"
  },
  "message": "Authentication successful."
}
```
2. `command`
```json
{
  "type": "command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "Command type",
      "data": "Command data"
    }
  }
}
```
