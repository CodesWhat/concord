// Patch BigInt serialization for drizzle-kit compatibility
BigInt.prototype.toJSON = function () {
  return this.toString();
};
