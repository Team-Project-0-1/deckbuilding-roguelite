import type { Command } from "@game/core";

const numericKey = (value: number): string => String(value).padStart(10, "0");
const targetKey = (target: number | undefined): string =>
  target === undefined ? "none" : numericKey(target);
const coinsKey = (coins: readonly number[] | undefined): string =>
  coins === undefined
    ? "none"
    : coins
        .map(Number)
        .sort((left, right) => left - right)
        .map(numericKey)
        .join(",");

export const commandKey = (command: Command): string => {
  switch (command.type) {
    case "endTurn":
      return "0:endTurn";
    case "placeCoin":
      return `1:placeCoin:slot=${numericKey(Number(command.slot))}:coin=${numericKey(Number(command.coin))}`;
    case "unplaceCoin":
      return `2:unplaceCoin:coin=${numericKey(Number(command.coin))}`;
    case "useFlipSkill":
      return `3:useFlipSkill:slot=${numericKey(Number(command.slot))}:target=${targetKey(command.target)}:chosen=${coinsKey(command.chosen)}`;
    case "useConsumeSkill": {
      const coins = coinsKey(command.coins);
      return `4:useConsumeSkill:slot=${numericKey(Number(command.slot))}:target=${targetKey(command.target)}:coins=${coins}`;
    }
  }
};

export const compareCommands = (left: Command, right: Command): number => {
  const leftKey = commandKey(left);
  const rightKey = commandKey(right);
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
};

export const stableCommandOrder = (commands: readonly Command[]): Command[] =>
  [...commands].sort(compareCommands);

export const canonicalFallbackCommand = (
  commands: readonly Command[],
): Command | undefined => {
  const ordered = stableCommandOrder(commands);
  return ordered.find((command) => command.type === "endTurn") ?? ordered[0];
};
