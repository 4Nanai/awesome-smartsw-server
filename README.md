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
- `uniqueHardwareId` must be provided
- `token` must be provided
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
- `uniqueHardwareId` must be provided
```json
{
  "type": "device_reconnect",
  "payload" : {
    "uniqueHardwareId": "Endpoint MAC address"
  }
}
```
3. `data_report`

Use to report all types of sensor data
- `type` must be provided
- `data` must be provided
```json
{
  "type": "data_report",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "sensor": [
      {
        "type": "Sensor type",
        "data": "Sensor data"
      }
    ]
  }
}
```
4. `endpoint_state`

Endpoint reports its current state
- `uniqueHardwareId` must be provided
- `state` must be provided
- `state` can be `on`, `off`, and `error`.
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on"
  }
}
```
5. `others` (Customized)

### Server to Endpoint
#### MESSAGE_TYPE
1. `auth_success`

Sent when device authentication is successful
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

Sent when user sends command to endpoint
- `uniqueHardwareId`, `type` and `state` must be provided
- `type` can be `toggle`...(TBD)
- `state` must be `boolean`
- `data` is optional
```json
{
  "type": "user_command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "toggle",
      "state": true,
      "data": "Command data"
    }
  }
}
```
3. `query_endpoint_state`

Sent when user queries endpoint state
- `uniqueHardwareId` is optional
- If not provided, server should return all endpoint states associated with the user
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

Sent when user authenticates
- `token` must be provided
```json
{
  "type": "user_auth",
  "payload": {
    "token": "User jwt token"
  }
}
```

2. `user_command`

Sent when user sends command to endpoint
- `uniqueHardwareId`, `type` and `state` must be provided
- `type` can be `toggle`...(TBD)
- `state` must be `boolean`
- `data` is optional
```json
{
  "type": "user_command",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "command": {
      "type": "toggle",
      "state": true,
      "data": "Command data"
    }
  }
}
```

3. `query_endpoint_state`

Sent when user queries endpoint state
- `uniqueHardwareId` is optional
- If not provided, server should return all endpoint states associated with the user
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

Sent when user authentication is successful
```json
{
    "type": "auth_success",
    "message": "User authentication successful."
}
```
2. `auth_failure`
```json
{
    "type": "auth_failure",
    "message": "Invalid or expired token."
}
```
3. `endpoint_state`

Sent when server returns endpoint state(s)
- `uniqueHardwareId` and `state` must be provided
- `state` can be `on`, `off`, `online`, `offline`, and `error`.
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on"
  }
}
```
