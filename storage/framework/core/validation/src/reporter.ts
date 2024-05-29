interface MessageObject {
    message: string;
    rule: string;
    field: string;
}

let messages: MessageObject[] = [] // Initialize as an empty array

export function reportError(errors: MessageObject[]): void {
    messages = errors
}

export function getErrors(): MessageObject[] {
    return messages
}