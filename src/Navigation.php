<?php

class Navigation {

	private $_pagesMeta;
	private $_homepage;
	private $_activePage;

    function __construct($pagesMeta, $activePage) {
        $this->_pagesMeta = $pagesMeta;
        $this->_homepage = $this->_pagesMeta[0];
        $this->_activePage = $activePage;
    }

	function render() {
		require 'template/navigation.phtml';
	}
}
