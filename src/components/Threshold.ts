import { defineComponent, Types } from 'bitecs';

// Marks a Threshold hex. When both avatars stand on their threshold hex AND both
// players confirm Ready, ThresholdSystem emits a BoardFlipEvent.
export const Threshold = defineComponent({ triggered: Types.ui8 });
