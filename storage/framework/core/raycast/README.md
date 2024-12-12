# Stacks Raycast

This project contains the Raycast extension for Stacks Buddy.

## API Reference

### Buddy Commands API

```http
  TODO: Stacks buddy command must first be deployed
```

#### Get all items

```http
  GET /api/commands
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `api_key` | `string` | **Required**. Your API key |

#### Search Command

```http
  GET /api/items/${command}
```

| Parameter | Type     | Description                                                |
| :-------- | :------- | :--------------------------------------------------------- |
| `id`      | `string` | **Required**. signature or description of command to fetch |

#### Get Versions

```http
  GET /api/versions
```

| Parameter | Type     | Description                |
| :-------- | :------- | :------------------------- |
| `api_key` | `string` | **Required**. Your API key |
