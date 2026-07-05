export interface Step {
  id: string;
  imageFile: string;
  caption: string;
  description: string;
  cursor: {
    x: number;
    y: number;
    visible: boolean;
  };
  crop: { x: number; y: number; width: number; height: number } | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  name: string;
  stepIds: string[];
}

export interface Guide {
  manifestVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  threads: Thread[];
  unsorted: { stepIds: string[] };
  steps: Record<string, Step>;
}
