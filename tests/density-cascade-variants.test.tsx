import { describe, expect, it } from "vite-plus/test";
import { render } from "@testing-library/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { TimeCalendar, type TimeCalendarEvent } from "@/components/ui/time-calendar";
import { DensityProvider } from "@/contexts/density-context";
import { Densities } from "@/types/density";
import { densityToIconButtonSize } from "@/components/ui/density-scale";

describe("Density Cascade - AlertDialog", () => {
  it("AlertDialogAction and AlertDialogCancel cascade Small density", () => {
    const { getByText } = render(
      <DensityProvider density={Densities.Small}>
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Action</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DensityProvider>,
    );

    const cancel = getByText("Cancel");
    const action = getByText("Action");

    expect(cancel.className).toContain("h-7");
    expect(cancel.className).toContain("text-xs");
    expect(action.className).toContain("h-7");
    expect(action.className).toContain("text-xs");
  });

  it("AlertDialogAction and AlertDialogCancel cascade Large density", () => {
    const { getByText } = render(
      <DensityProvider density={Densities.Large}>
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Action</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DensityProvider>,
    );

    const cancel = getByText("Cancel");
    const action = getByText("Action");

    expect(cancel.className).toContain("h-11");
    expect(cancel.className).toContain("text-base");
    expect(action.className).toContain("h-11");
    expect(action.className).toContain("text-base");
  });

  it("AlertDialogAction and AlertDialogCancel default to Medium without provider", () => {
    const { getByText } = render(
      <AlertDialog defaultOpen>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Action</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    const cancel = getByText("Cancel");
    const action = getByText("Action");

    expect(cancel.className).toContain("h-9");
    expect(action.className).toContain("h-9");
  });

  it("explicit size prop overrides density context", () => {
    const { getByText } = render(
      <DensityProvider density={Densities.Small}>
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogAction size="lg">Action</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DensityProvider>,
    );

    const action = getByText("Action");
    expect(action.className).toContain("h-11");
    expect(action.className).toContain("text-base");
  });
});

describe("Density Cascade - Pagination", () => {
  it("Pagination components cascade Small density", () => {
    const { container } = render(
      <DensityProvider density={Densities.Small}>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </DensityProvider>,
    );

    const content = container.querySelector("ul");
    const link = container.querySelector("a");
    const previous = container.querySelectorAll("a")[1];
    const ellipsis = container.querySelector("span[aria-hidden]");

    expect(content?.className).toContain("gap-0.5");
    expect(link?.className).toContain("size-7");
    expect(previous?.className).toContain("h-7");
    expect(ellipsis?.className).toContain("size-7");
  });

  it("Pagination components cascade Large density", () => {
    const { container } = render(
      <DensityProvider density={Densities.Large}>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </DensityProvider>,
    );

    const content = container.querySelector("ul");
    const link = container.querySelector("a");
    const next = container.querySelectorAll("a")[1];
    const ellipsis = container.querySelector("span[aria-hidden]");

    expect(content?.className).toContain("gap-1.5");
    expect(link?.className).toContain("size-11");
    expect(next?.className).toContain("h-11");
    expect(ellipsis?.className).toContain("size-11");
  });
});

describe("Density Cascade - Calendar", () => {
  it("Calendar cascades Large density from provider", () => {
    const { container } = render(
      <DensityProvider density={Densities.Large}>
        <Calendar />
      </DensityProvider>,
    );

    const calendar = container.querySelector('[data-slot="calendar"]');
    expect(calendar?.className).toContain("[--cell-size:--spacing(10)]");
  });

  it("explicit density prop overrides provider", () => {
    const { container } = render(
      <DensityProvider density={Densities.Large}>
        <Calendar density={Densities.Small} />
      </DensityProvider>,
    );

    const calendar = container.querySelector('[data-slot="calendar"]');
    expect(calendar?.className).toContain("[--cell-size:--spacing(6)]");
  });
});

describe("Density Cascade - TimeCalendar", () => {
  const events: TimeCalendarEvent[] = [
    { id: "a", date: "2026-10-23", start: "08:30", end: "12:00", title: "Acme Logistik" },
  ];
  const NOW = new Date(2026, 9, 23, 14, 30);

  const renderCalendar = (density?: Densities, provider?: Densities, view?: "month" | "week") =>
    render(
      <DensityProvider density={provider}>
        <TimeCalendar
          events={events}
          now={NOW}
          defaultDate="2026-10-23"
          defaultView={view}
          compact={false}
          density={density}
        />
      </DensityProvider>,
    );

  /** The root, a header button, the Month/Week item and the first entry of the month grid. */
  const parts = (container: HTMLElement) => ({
    root: container.querySelector("section")!,
    header: container.querySelector("section > div")!,
    previous: container.querySelector('button[aria-label="Previous month"]')!,
    today: Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Today")!,
    monthItem: container.querySelector('[role="radio"]')!,
    chip: container.querySelector('[data-event-id="a"]')!,
  });

  it("cascades Small density from the provider to every part", () => {
    const { container } = renderCalendar(undefined, Densities.Small);
    const { root, previous, today, monthItem, chip } = parts(container);
    expect(root.className).toContain("[--sc-hour:2.5rem]");
    expect(root.className).toContain("[--sc-cell-min:6rem]");
    expect(previous.className).toContain("size-7");
    expect(today.className).toContain("h-7");
    expect(monthItem.className).toContain("h-8");
    expect(chip.className).toContain("h-4");
  });

  it("cascades Large density from the provider to every part", () => {
    const { container } = renderCalendar(undefined, Densities.Large);
    const { root, previous, today, monthItem, chip } = parts(container);
    expect(root.className).toContain("[--sc-hour:3.5rem]");
    expect(root.className).toContain("[--sc-cell-min:8.25rem]");
    expect(previous.className).toContain("size-11");
    expect(today.className).toContain("h-11");
    expect(monthItem.className).toContain("h-10");
    expect(chip.className).toContain("h-6");
  });

  it("defaults to Medium without a provider", () => {
    const { container } = renderCalendar();
    const { root, previous, today, monthItem, chip } = parts(container);
    expect(root.className).toContain("[--sc-hour:3rem]");
    expect(previous.className).toContain("size-9");
    expect(today.className).toContain("h-9");
    expect(monthItem.className).toContain("h-9");
    expect(chip.className).toContain("h-5");
  });

  it("lets the density prop override the provider", () => {
    const { container } = renderCalendar(Densities.Small, Densities.Large);
    const { root, header, previous, today, monthItem, chip } = parts(container);
    expect(root.className).toContain("[--sc-hour:2.5rem]");
    expect(root.className).not.toContain("[--sc-hour:3.5rem]");
    // The header, its buttons and the Month/Week switch follow the prop and not the provider.
    expect(header.className).toContain("gap-x-1.5");
    expect(header.className).not.toContain("gap-x-3");
    expect(previous.className).toContain("size-7");
    expect(today.className).toContain("h-7");
    expect(monthItem.className).toContain("h-8");
    expect(monthItem.className).not.toContain("h-10");
    expect(chip.className).toContain("h-4");
  });

  it("sizes the header gap and the day number by density", () => {
    const large = renderCalendar(undefined, Densities.Large);
    expect(parts(large.container).header.className).toContain("gap-x-3");
    expect(large.container.querySelector('[aria-current="date"] span')?.className).toContain(
      "size-7",
    );
    large.unmount();
    const small = renderCalendar(undefined, Densities.Small);
    expect(parts(small.container).header.className).toContain("gap-x-1.5");
    expect(small.container.querySelector('[aria-current="date"] span')?.className).toContain(
      "size-5",
    );
  });

  it("sizes the week's hour labels and blocks by density", () => {
    const hourLabel = (container: HTMLElement) =>
      [...container.querySelectorAll("span")].find((span) => span.textContent === "06:00");
    const large = renderCalendar(undefined, Densities.Large, "week");
    expect(large.container.querySelector("section")?.className).toContain("[--sc-hour:3.5rem]");
    expect(large.container.querySelector('[data-event-id="a"]')?.className).toContain("text-sm");
    expect(hourLabel(large.container)?.className).toContain("text-xs");
    expect(large.container.querySelector('[role="rowheader"]')).toBeNull();
    large.unmount();

    const small = renderCalendar(undefined, Densities.Small, "week");
    expect(small.container.querySelector('[data-event-id="a"]')?.className).toContain(
      "text-[10px]",
    );
    expect(hourLabel(small.container)?.className).toContain("text-[10px]");
    small.unmount();

    const medium = renderCalendar(undefined, undefined, "week");
    expect(hourLabel(medium.container)?.className).toContain("text-[11px]");
  });
});

describe("densityToIconButtonSize", () => {
  it("maps Small to icon-sm", () => {
    expect(densityToIconButtonSize(Densities.Small)).toBe("icon-sm");
  });

  it("maps Medium to icon", () => {
    expect(densityToIconButtonSize(Densities.Medium)).toBe("icon");
  });

  it("maps Large to icon-lg", () => {
    expect(densityToIconButtonSize(Densities.Large)).toBe("icon-lg");
  });
});
