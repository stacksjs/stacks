type Argument = {
    name: string;
    description: string;
    value_required: boolean;
}

type Option = {
    name: string;
    description: string;
}

export type BuddyCommand = {
    signature: string;
    description: string;
    synopsis: string;
    arguments: Argument[];
    options: Option[];
}