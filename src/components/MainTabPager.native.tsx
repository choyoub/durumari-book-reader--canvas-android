import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import PagerView from "react-native-pager-view";

import { TabName } from "../contexts/AppContext";
import { BookmarksScreen } from "../screens/BookmarksScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { LibraryScreen } from "../screens/LibraryScreen";

const MAIN_TABS: readonly TabName[] = ["library", "history", "bookmarks"];

type MainTabPagerProps = {
  search: string;
  onSearchChange: (search: string) => void;
  tab: TabName;
  onTabChange: (tab: TabName) => void;
};

export function MainTabPager({ search, onSearchChange, tab, onTabChange }: MainTabPagerProps) {
  const pagerRef = useRef<PagerView>(null);
  const currentPageRef = useRef(MAIN_TABS.indexOf(tab));
  const selectedPage = MAIN_TABS.indexOf(tab);

  useEffect(() => {
    if (selectedPage === currentPageRef.current) return;
    currentPageRef.current = selectedPage;
    pagerRef.current?.setPage(selectedPage);
  }, [selectedPage]);

  return (
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={selectedPage}
      overScrollMode="never"
      onPageSelected={(event) => {
        const page = event.nativeEvent.position;
        const nextTab = MAIN_TABS[page];
        if (!nextTab) return;
        currentPageRef.current = page;
        onTabChange(nextTab);
      }}
    >
      <View key="library" style={styles.page} collapsable={false}>
        <LibraryScreen search={search} onSearchChange={onSearchChange} />
      </View>
      <View key="history" style={styles.page} collapsable={false}>
        <HistoryScreen search={search} onSearchChange={onSearchChange} />
      </View>
      <View key="bookmarks" style={styles.page} collapsable={false}>
        <BookmarksScreen search={search} onSearchChange={onSearchChange} />
      </View>
    </PagerView>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1 },
  page: { flex: 1 },
});
