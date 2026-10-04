"use client";

import { forwardRef } from "react";
import { Tabs as Primitive } from "radix-ui";

// Radix's default outline/first-frame-animation inline styles are optional
// presentation. Keep its keyboard/focus semantics, while using external CSS
// for all presentation under the existing strict Content Security Policy.
const Surface = forwardRef(function Surface({ style: _style, ...props }, ref) {
  return <div {...props} ref={ref} />;
});

const List = forwardRef(function List({ children, ...props }, ref) {
  return (
    <Primitive.List {...props} asChild ref={ref}>
      <Surface>{children}</Surface>
    </Primitive.List>
  );
});

const Content = forwardRef(function Content({ children, ...props }, ref) {
  return (
    <Primitive.Content {...props} asChild ref={ref}>
      <Surface>{children}</Surface>
    </Primitive.Content>
  );
});

export const Tabs = {
  Root: Primitive.Root,
  Trigger: Primitive.Trigger,
  List,
  Content,
};
