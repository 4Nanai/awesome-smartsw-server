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
1. `device_auth`
```json
{
  "type": "device_auth",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "token": "Device binding token"
  }
}
```
2. `device_reconnect`
Used when endpoint device needs to reconnect to the server
```json
{
  "type": "device_reconnect",
  "payload" : {
    "uniqueHardwareId": "Endpoint MAC address"
  }
}
```
3. `data_report`
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
4. `endpoint_state`
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on" | "off" | "online" | "offline" | "error",
  }
}
```
5. `others` (Customized)

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
2. `user_command`
```json
{
  "type": "user_command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "Command type",
      "data": "Command data"
    }
  }
}
```
3. `query_endpoint_state`
```json
{
  "type": "query_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address"
  }
}
```

### User to Server
#### MESSAGE_TYPE
1. `user_auth`
```json
{
  "type": "user_auth",
  "payload": {
    "token": "User jwt token"
  }
}
```

2. `user_command`
```json
{
  "type": "user_command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "Command type",
      "data": "Command data"
    }
  }
}
```

3. `query_endpoint_state`
```json
{
  "type": "query_endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address(Optional)"
  }
}
```

### Server to User
#### MESSAGE_TYPE
1. `auth_success`
```json
{
    "type": "auth_success",
    "message": "User authentication successful."
}
```
2. `new_device_connected`
```json
{
    "type": "new_device_connected",
    "payload": {
        "token": "Device binding token"
    }
}
```
3. `endpoint_state`
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on" | "off" | "online" | "offline" | "error",
  }
}
```
