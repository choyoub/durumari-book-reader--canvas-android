import React from "react";
import { View } from "react-native";

import { TabName } from "../contexts/AppContext";
import { BookmarksScreen } from "../screens/BookmarksScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { LibraryScreen } from "../screens/LibraryScreen";

type MainTabPagerProps = {
  search: string;
  tab: TabName;
  onTabChange: (tab: TabName) => void;
};

export function MainTabPager({ search, tab }: MainTabPagerProps) {
  return (
    <View style={{ flex: 1 }}>
      {tab === "library" && <LibraryScreen search={search} />}
      {tab === "history" && <HistoryScreen search={search} />}
      {tab === "bookmarks" && <BookmarksScreen search={search} />}
    </View>
  );
}
