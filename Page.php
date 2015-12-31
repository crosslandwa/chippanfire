<?php

class Page {
	private $_header;
	private $_navigation;
	private $_meta;

    function __construct($meta, $navigation) {
        $this->_header = new Header();
        $this->_navigation = $navigation;
        $this->_meta = $meta;
    }

    function filename() {
    	return $this->_meta->filename();
    }

    function renderContent() {
    	require $this->_meta->contentFilename();
    }

	function render() {
		require 'page.phtml';
	}
}