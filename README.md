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
- `sensor` must be provided, and it should contain at least one or more sensor data object
  - `temp_humi`: temperature and humidity sensor data (degC, RH%, UTC epoch)
  - `pir`: PIR motion sensor data (present, UTC epoch)
  - `radar`: Radar motion sensor data (present, UTC epoch)
  - `sound`: Sound sensor data (UTC epoch of last detected sound)
```json
{
  "type": "data_report",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "sensor": {
      "temp_humi": {
        "temperature": 25.5,
        "humidity": 60,
        "ts": 1625247600
      },
      "pir": {
        "state": true,
        "ts": 1625247600
      },
      "radar": {
        "state": false,
        "ts": 1625247600
      },
      "sound": {
        "ts": 1625247600
      }
    }
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

4. `set_automation_mode`

Configure automation mode for endpoint device behavior
- `uniqueHardwareId` must be provided
- `mode` must be one of: `off`, `presence`, `sound`, `timer`, `ml`
  - `off`: Disable automation
  - `presence`: Triggered by human presence detection
  - `sound`: Triggered by sound detection
  - `timer`: Triggered by scheduled timer
  - `ml`: Triggered by machine learning model
```json
{
  "type": "set_automation_mode",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "mode": "presence"
  }
}
```

5. `set_presence_mode`

Configure human presence detection mode
- `uniqueHardwareId` must be provided
- `mode` must be one of: `pir_only`, `radar_only`, `fusion_or`, `fusion_and`
  - `pir_only`: Use PIR sensor only
  - `radar_only`: Use radar sensor only
  - `fusion_or`: Trigger when either PIR or radar detects
  - `fusion_and`: Trigger when both PIR and radar detect simultaneously
```json
{
  "type": "set_presence_mode",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "mode": "fusion_or"
  }
}
```

6. `set_sound_mode`

Configure sound detection mode
- `uniqueHardwareId` must be provided
- `mode` must be one of: `noise`, `clap`
  - `noise`: Trigger on any loud noise
  - `clap`: Trigger on clap detection
```json
{
  "type": "set_sound_mode",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "mode": "clap"
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
- `state` can be `on`, `off`, `error`.
```json
{
  "type": "endpoint_state",
  "payload": {
    "uniqueHardwareId": "Endpoint MAC address",
    "state": "on"
  }
}
```
