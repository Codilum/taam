"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  setActiveBlock,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: any[]
  }[]
  setActiveBlock: (block: string) => void
}) {
  const { setOpenMobile } = useSidebar();

  const handleItemClick = (url: string) => {
    setActiveBlock(url);
    setOpenMobile(false);
  };

  const renderMenuItems = (menuItems: any[], level: number = 1) => {
    return menuItems.map((item) => {
      const hasChildren = item.items && item.items.length > 0;

      if (!hasChildren) {
        if (level === 1) {
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} onClick={() => handleItemClick(item.url)} data-active={item.isActive}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuSubItem key={item.title}>
            <SidebarMenuSubButton asChild isActive={item.isActive}>
              <button onClick={() => handleItemClick(item.url)}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </button>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        );
      }

      const Content = (
        <Collapsible
          key={item.title}
          asChild
          defaultOpen={item.isActive}
          className="group/collapsible"
        >
          {level === 1 ? (
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {renderMenuItems(item.items, level + 1)}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuSubItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuSubButton>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuSubButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="ml-4 border-l">
                  {renderMenuItems(item.items, level + 1)}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuSubItem>
          )}
        </Collapsible>
      );

      return Content;
    });
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Панель управления</SidebarGroupLabel>
      <SidebarMenu>
        {renderMenuItems(items)}
      </SidebarMenu>
    </SidebarGroup>
  )
}